//go:build linux

// Versão Android (e Linux). Lê/escreve a memória do jogo por
// /proc/<pid>/mem, o que exige ROOT no Android.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// No Android o processo se chama info.flowersoft.theotown.theotown.
func isGame(name string) bool {
	return contains(name, "theotown")
}

func listProcesses() []proc {
	entries, _ := os.ReadDir("/proc")
	var out []proc
	self := os.Getpid()
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil || pid == self {
			continue
		}
		b, err := os.ReadFile("/proc/" + e.Name() + "/cmdline")
		if err != nil || len(b) == 0 {
			continue
		}
		name := string(b)
		if i := strings.IndexByte(name, 0); i >= 0 {
			name = name[:i]
		}
		if i := strings.LastIndexByte(name, '/'); i >= 0 {
			name = name[i+1:]
		}
		out = append(out, proc{uint32(pid), name})
	}
	return out
}

type linuxMemory struct {
	pid int
	f   *os.File
}

func openProcess(pid uint32) memory {
	f, err := os.OpenFile(fmt.Sprintf("/proc/%d/mem", pid), os.O_RDWR, 0)
	if err != nil {
		fail(fmt.Sprint("Não consegui abrir a memória do jogo: ", err,
			"\nEste programa precisa de ROOT. Rode com: su -c /data/local/tmp/theotown-dinheiro"))
	}
	return &linuxMemory{int(pid), f}
}

func (l *linuxMemory) regions() []region {
	f, err := os.Open(fmt.Sprintf("/proc/%d/maps", l.pid))
	if err != nil {
		return nil
	}
	defer f.Close()
	var out []region
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		// formato: inicio-fim perms offset dev inode [caminho]
		fields := strings.Fields(sc.Text())
		if len(fields) < 5 || len(fields[1]) < 2 || fields[1][0] != 'r' || fields[1][1] != 'w' {
			continue
		}
		path := ""
		if len(fields) >= 6 {
			path = fields[5]
		}
		// Pula memória de dispositivos (GPU etc.) e arquivos mapeados.
		if path != "" && !strings.HasPrefix(path, "[") {
			continue
		}
		if strings.HasPrefix(path, "[vvar") || strings.HasPrefix(path, "[vsyscall") {
			continue
		}
		parts := strings.SplitN(fields[0], "-", 2)
		start, err1 := strconv.ParseUint(parts[0], 16, 64)
		end, err2 := strconv.ParseUint(parts[1], 16, 64)
		if err1 != nil || err2 != nil || end <= start {
			continue
		}
		out = append(out, region{uintptr(start), uintptr(end - start)})
	}
	return out
}

func (l *linuxMemory) read(addr uintptr, buf []byte) bool {
	n, err := l.f.ReadAt(buf, int64(addr))
	return err == nil && n == len(buf)
}

func (l *linuxMemory) write(addr uintptr, buf []byte) bool {
	n, err := l.f.WriteAt(buf, int64(addr))
	return err == nil && n == len(buf)
}

func (l *linuxMemory) close() { l.f.Close() }
