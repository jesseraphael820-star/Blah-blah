// Editor de dinheiro para TheoTown (modo single-player).
// Funciona como um "Cheat Engine" simplificado: procura na memória do jogo
// o valor atual do seu dinheiro, filtra os resultados conforme o valor muda
// e depois escreve o valor que você quiser.
//
// Windows: mem_windows.go  |  Android/Linux (precisa de root): mem_linux.go
package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type proc struct {
	pid  uint32
	name string
}

type region struct {
	base uintptr
	size uintptr
}

// Acesso à memória do jogo; implementado por sistema operacional.
type memory interface {
	regions() []region
	read(addr uintptr, buf []byte) bool
	write(addr uintptr, buf []byte) bool
	close()
}

// candidato = endereço + tamanho (4 = int32, 8 = int64)
type candidate struct {
	addr uintptr
	size int
}

var in = bufio.NewReader(os.Stdin)

func ask(msg string) string {
	fmt.Print(msg)
	s, err := in.ReadString('\n')
	if err != nil && s == "" {
		os.Exit(0)
	}
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

func fail(msg string) {
	fmt.Println(msg)
	ask("Aperte ENTER para sair...")
	os.Exit(1)
}

func chooseProcess() proc {
	for {
		var matches []proc
		for _, p := range listProcesses() {
			if isGame(strings.ToLower(p.name)) {
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

// Primeira busca: varre a memória gravável procurando o valor.
func firstScan(m memory, value int64) []candidate {
	var out []candidate
	const chunk = 4 << 20
	buf := make([]byte, chunk)
	fits32 := value >= -1<<31 && value < 1<<31
	for _, r := range m.regions() {
		for off := uintptr(0); off < r.size; off += chunk {
			size := r.size - off
			if size > chunk {
				size = chunk
			}
			b := buf[:size]
			base := r.base + off
			if !m.read(base, b) {
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
	return out
}

func readValue(m memory, c candidate) (int64, bool) {
	b := make([]byte, c.size)
	if !m.read(c.addr, b) {
		return 0, false
	}
	if c.size == 8 {
		return int64(binary.LittleEndian.Uint64(b)), true
	}
	return int64(int32(binary.LittleEndian.Uint32(b))), true
}

func filter(m memory, cs []candidate, value int64) []candidate {
	var out []candidate
	for _, c := range cs {
		if v, ok := readValue(m, c); ok && v == value {
			out = append(out, c)
		}
	}
	return out
}

func writeValue(m memory, cs []candidate, value int64) int {
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
		if m.write(c.addr, b) {
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
	m := openProcess(p.pid)
	defer m.close()

	for {
		fmt.Println("PASSO 1: Olhe quanto dinheiro sua cidade tem agora.")
		value := askNumber("Digite o valor EXATO do seu dinheiro atual: ")
		fmt.Println("Procurando na memória do jogo... (pode levar alguns segundos)")
		cs := firstScan(m, value)
		fmt.Printf("  %d resultados encontrados.\n\n", len(cs))

		for len(cs) > 5 {
			fmt.Println("PASSO 2: Volte ao jogo e faça o dinheiro mudar")
			fmt.Println("  (construa uma estrada, demolir algo, esperar o dia virar, etc.)")
			value = askNumber("Digite o NOVO valor do dinheiro: ")
			cs = filter(m, cs, value)
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
			n := writeValue(m, cs, want)
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
							writeValue(m, cs, want)
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
