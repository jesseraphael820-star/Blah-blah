//go:build windows

package main

import (
	"fmt"
	"syscall"
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

// No PC o TheoTown roda como TheoTown*.exe ou via java(w).exe.
func isGame(name string) bool {
	return contains(name, "theotown") || hasPrefix(name, "java")
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

type winMemory struct{ h uintptr }

func openProcess(pid uint32) memory {
	h, _, err := procOpenProcess.Call(processVMRead|processVMWrite|processVMOp|processQueryInfo, 0, uintptr(pid))
	if h == 0 {
		fail(fmt.Sprint("Não consegui abrir o processo do jogo: ", err,
			"\nTente executar este programa como Administrador (botão direito > Executar como administrador)."))
	}
	return &winMemory{h}
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

func (w *winMemory) regions() []region {
	var out []region
	var mbi memoryBasicInfo
	var addr uintptr
	for {
		r, _, _ := procVirtualQueryEx.Call(w.h, addr, uintptr(unsafe.Pointer(&mbi)), unsafe.Sizeof(mbi))
		if r == 0 {
			break
		}
		next := mbi.BaseAddress + mbi.RegionSize
		if next <= addr {
			break
		}
		if mbi.State == memCommit && writable(mbi.Protect) && mbi.Type != memMapped {
			out = append(out, region{mbi.BaseAddress, mbi.RegionSize})
		}
		addr = next
	}
	return out
}

func (w *winMemory) read(addr uintptr, buf []byte) bool {
	var n uintptr
	r, _, _ := procReadProcessMemory.Call(w.h, addr, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), uintptr(unsafe.Pointer(&n)))
	return r != 0 && int(n) == len(buf)
}

func (w *winMemory) write(addr uintptr, buf []byte) bool {
	var n uintptr
	r, _, _ := procWriteProcessMemory.Call(w.h, addr, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), uintptr(unsafe.Pointer(&n)))
	return r != 0 && int(n) == len(buf)
}

func (w *winMemory) close() { procCloseHandle.Call(w.h) }
