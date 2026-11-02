//go:build windows

// Editor de dinheiro para TheoTown (modo single-player).
// Funciona como um "Cheat Engine" simplificado: procura na memória do jogo
// o valor atual do seu dinheiro, filtra os resultados conforme o valor muda
// e depois escreve o valor que você quiser.
package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

var (
	kernel32               = syscall.NewLazyDLL("kernel32.dll")
	procCreateSnapshot     = kernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32FirstW    = kernel32.NewProc("Process32FirstW")
	procProcess32NextW     = kernel32.NewProc("Process32NextW")
	procOpenProcess        = kernel32.NewProc("OpenProcess")
	procVirtualQueryEx     = kernel32.NewProc("VirtualQueryEx")
	procReadProcessMemory  = kernel32.NewProc("ReadProcessMemory")
	procWriteProcessMemory = kernel32.NewProc("WriteProcessMemory")
	procCloseHandle        = kernel32.NewProc("CloseHandle")
)

const (
	th32csSnapProcess = 0x00000002
	processVMRead     = 0x0010
	processVMWrite    = 0x0020
	processVMOp       = 0x0008
	processQueryInfo  = 0x0400

	memCommit = 0x1000
	memMapped = 0x40000
	pageGuard = 0x100

	pageReadWrite        = 0x04
	pageWriteCopy        = 0x08
	pageExecuteReadWrite = 0x40
	pageExecuteWriteCopy = 0x80
)

type processEntry32 struct {
	Size            uint32
	Usage           uint32
	ProcessID       uint32
	DefaultHeapID   uintptr
	ModuleID        uint32
	Threads         uint32
	ParentProcessID uint32
	PriClassBase    int32
	Flags           uint32
	ExeFile         [260]uint16
}

type memoryBasicInfo struct {
	BaseAddress       uintptr
	AllocationBase    uintptr
	AllocationProtect uint32
	PartitionID       uint16
	RegionSize        uintptr
	State             uint32
	Protect           uint32
	Type              uint32
}

type proc struct {
	pid  uint32
	name string
}

// candidato = endereço + tamanho (4 = int32, 8 = int64)
type candidate struct {
	addr uintptr
	size int
}

var in = bufio.NewReader(os.Stdin)

func ask(msg string) string {
	fmt.Print(msg)
	s, _ := in.ReadString('\n')
	return strings.TrimSpace(s)
}

func askNumber(msg string) int64 {
	for {
		s := ask(msg)
		s = strings.NewReplacer(".", "", ",", "", " ", "", "$", "", "T", "", "t", "").Replace(s)
		v, err := strconv.ParseInt(s, 10, 64)
		if err == nil {
			return v
		}
		fmt.Println("  Número inválido, tente de novo.")
	}
}

func listProcesses() []proc {
	snap, _, _ := procCreateSnapshot.Call(th32csSnapProcess, 0)
	if snap == uintptr(syscall.InvalidHandle) {
		return nil
	}
	defer procCloseHandle.Call(snap)
	var e processEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	var out []proc
	r, _, _ := procProcess32FirstW.Call(snap, uintptr(unsafe.Pointer(&e)))
	for r != 0 {
		out = append(out, proc{e.ProcessID, syscall.UTF16ToString(e.ExeFile[:])})
		r, _, _ = procProcess32NextW.Call(snap, uintptr(unsafe.Pointer(&e)))
	}
	return out
}

func chooseProcess() proc {
	for {
		var matches []proc
		for _, p := range listProcesses() {
			n := strings.ToLower(p.name)
			if strings.Contains(n, "theotown") || strings.HasPrefix(n, "java") {
				matches = append(matches, p)
			}
		}
		if len(matches) == 1 {
			fmt.Printf("Jogo encontrado: %s (PID %d)\n\n", matches[0].name, matches[0].pid)
			return matches[0]
		}
		if len(matches) > 1 {
			fmt.Println("Mais de um processo encontrado:")
			for i, p := range matches {
				fmt.Printf("  [%d] %s (PID %d)\n", i+1, p.name, p.pid)
			}
			i := askNumber("Escolha o número: ")
			if i >= 1 && int(i) <= len(matches) {
				return matches[i-1]
			}
			continue
		}
		fmt.Println("TheoTown não foi encontrado. Abra o jogo e carregue sua cidade.")
		ask("Aperte ENTER para procurar de novo...")
	}
}

func openProcess(pid uint32) uintptr {
	h, _, err := procOpenProcess.Call(processVMRead|processVMWrite|processVMOp|processQueryInfo, 0, uintptr(pid))
	if h == 0 {
		fmt.Println("Não consegui abrir o processo do jogo:", err)
		fmt.Println("Tente executar este programa como Administrador (botão direito > Executar como administrador).")
		ask("Aperte ENTER para sair...")
		os.Exit(1)
	}
	return h
}

func readMem(h, addr uintptr, buf []byte) bool {
	var n uintptr
	r, _, _ := procReadProcessMemory.Call(h, addr, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), uintptr(unsafe.Pointer(&n)))
	return r != 0 && int(n) == len(buf)
}

func writeMem(h, addr uintptr, buf []byte) bool {
	var n uintptr
	r, _, _ := procWriteProcessMemory.Call(h, addr, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), uintptr(unsafe.Pointer(&n)))
	return r != 0 && int(n) == len(buf)
}

func writable(p uint32) bool {
	if p&pageGuard != 0 {
		return false
	}
	switch p & 0xff {
	case pageReadWrite, pageWriteCopy, pageExecuteReadWrite, pageExecuteWriteCopy:
		return true
	}
	return false
}

// Primeira busca: varre toda a memória gravável procurando o valor como int32 e int64.
func firstScan(h uintptr, value int64) []candidate {
	var out []candidate
	var mbi memoryBasicInfo
	var addr uintptr
	const chunk = 4 << 20
	buf := make([]byte, chunk)
	fits32 := value >= -1<<31 && value < 1<<31
	for {
		r, _, _ := procVirtualQueryEx.Call(h, addr, uintptr(unsafe.Pointer(&mbi)), unsafe.Sizeof(mbi))
		if r == 0 {
			break
		}
		next := mbi.BaseAddress + mbi.RegionSize
		if next <= addr {
			break
		}
		if mbi.State == memCommit && writable(mbi.Protect) && mbi.Type != memMapped {
			for off := uintptr(0); off < mbi.RegionSize; off += chunk {
				size := mbi.RegionSize - off
				if size > chunk {
					size = chunk
				}
				b := buf[:size]
				base := mbi.BaseAddress + off
				if !readMem(h, base, b) {
					continue
				}
				for i := 0; i+4 <= len(b); i += 4 {
					// Se cabe em int32, guarda como int32 (escrever 4 bytes nunca
					// estraga o campo vizinho). Senão procura int64 alinhado em 8.
					if fits32 {
						if int64(int32(binary.LittleEndian.Uint32(b[i:]))) == value {
							out = append(out, candidate{base + uintptr(i), 4})
						}
					} else if i%8 == 0 && i+8 <= len(b) && int64(binary.LittleEndian.Uint64(b[i:])) == value {
						out = append(out, candidate{base + uintptr(i), 8})
					}
				}
			}
		}
		addr = next
	}
	return out
}

func readValue(h uintptr, c candidate) (int64, bool) {
	b := make([]byte, c.size)
	if !readMem(h, c.addr, b) {
		return 0, false
	}
	if c.size == 8 {
		return int64(binary.LittleEndian.Uint64(b)), true
	}
	return int64(int32(binary.LittleEndian.Uint32(b))), true
}

func filter(h uintptr, cs []candidate, value int64) []candidate {
	var out []candidate
	for _, c := range cs {
		if v, ok := readValue(h, c); ok && v == value {
			out = append(out, c)
		}
	}
	return out
}

func writeValue(h uintptr, cs []candidate, value int64) int {
	ok := 0
	for _, c := range cs {
		b := make([]byte, c.size)
		if c.size == 8 {
			binary.LittleEndian.PutUint64(b, uint64(value))
		} else {
			v := value
			if v > 1<<31-1 {
				v = 1<<31 - 1 // máximo de um int32 (~2,1 bilhões)
			}
			binary.LittleEndian.PutUint32(b, uint32(int32(v)))
		}
		if writeMem(h, c.addr, b) {
			ok++
		}
	}
	return ok
}

func main() {
	fmt.Println("==============================================")
	fmt.Println("      TheoTown - Editor de Dinheiro")
	fmt.Println("==============================================")
	fmt.Println("Use só em cidades single-player (offline).")
	fmt.Println()

	p := chooseProcess()
	h := openProcess(p.pid)
	defer procCloseHandle.Call(h)

	for {
		fmt.Println("PASSO 1: Olhe quanto dinheiro sua cidade tem agora.")
		value := askNumber("Digite o valor EXATO do seu dinheiro atual: ")
		fmt.Println("Procurando na memória do jogo... (pode levar alguns segundos)")
		cs := firstScan(h, value)
		fmt.Printf("  %d resultados encontrados.\n\n", len(cs))

		for len(cs) > 5 {
			fmt.Println("PASSO 2: Volte ao jogo e faça o dinheiro mudar")
			fmt.Println("  (construa uma estrada, demolir algo, esperar o dia virar, etc.)")
			value = askNumber("Digite o NOVO valor do dinheiro: ")
			cs = filter(h, cs, value)
			fmt.Printf("  %d resultados restantes.\n\n", len(cs))
		}

		if len(cs) == 0 {
			fmt.Println("Nenhum resultado. Vamos recomeçar (confira se digitou o valor certo).")
			fmt.Println()
			continue
		}

		fmt.Println("Pronto! Dinheiro localizado.")
		for {
			want := askNumber("PASSO 3: Digite quanto dinheiro você quer ter (máx. 2147483647): ")
			n := writeValue(h, cs, want)
			fmt.Printf("  Valor escrito em %d endereço(s). Volte ao jogo e confira!\n\n", n)

			fmt.Println("O que fazer agora?")
			fmt.Println("  [1] Mudar o valor de novo")
			fmt.Println("  [2] Congelar o dinheiro (fica sempre nesse valor)")
			fmt.Println("  [3] Buscar de novo (se não funcionou)")
			fmt.Println("  [4] Sair")
			switch ask("Escolha: ") {
			case "1":
				continue
			case "2":
				stop := make(chan struct{})
				go func() {
					for {
						select {
						case <-stop:
							return
						default:
							writeValue(h, cs, want)
							time.Sleep(300 * time.Millisecond)
						}
					}
				}()
				ask("Dinheiro congelado! Aperte ENTER para descongelar...")
				close(stop)
				fmt.Println()
				continue
			case "3":
				fmt.Println()
			default:
				return
			}
			break
		}
	}
}
