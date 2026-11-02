; VPC Boot Monitor — tiny real-mode x86 operating environment.
; Original code for Virtual PC. Build: nasm -f bin vpcboot.asm -o ../../www/images/vpcboot.img
; Runs on real x86 hardware or any PC emulator (here: v86 WebAssembly).
bits 16
org 0x7C00

start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00
    sti
    mov [boot_drive], dl
    ; load stage 2 (sectors 2..17) to 0x7E00
    mov ah, 0x02
    mov al, 16
    mov ch, 0
    mov cl, 2
    mov dh, 0
    mov dl, [boot_drive]
    mov bx, 0x7E00
    int 0x13
    jc disk_err
    jmp stage2
disk_err:
    mov si, msg_disk
.l: lodsb
    or al, al
    jz $
    mov ah, 0x0E
    int 0x10
    jmp .l
msg_disk db "Disk read error", 0
boot_drive db 0
times 510-($-$$) db 0
dw 0xAA55

; ---------------- stage 2 ----------------
stage2:
    mov ax, 0x0003
    int 0x10
    mov byte [attr], 0x1F
    call cls
    mov si, banner
    call puts
    call cmd_mem
    call cmd_cpu
    mov si, hint
    call puts
main_loop:
    mov si, prompt
    call puts
    call readline
    call newline
    mov si, linebuf
    cmp byte [si], 0
    je main_loop
    mov di, s_help
    call strcmp
    je .help
    mov di, s_cls
    call strcmp
    je .cls
    mov di, s_mem
    call strcmp
    je .mem
    mov di, s_cpu
    call strcmp
    je .cpu
    mov di, s_time
    call strcmp
    je .time
    mov di, s_reboot
    call strcmp
    je .reboot
    mov di, s_color
    call strcmp
    je .color
    mov di, s_ver
    call strcmp
    je .ver
    mov di, s_count
    call strcmp
    je .count
    mov si, unknown
    call puts
    jmp main_loop
.help:  mov si, helptxt
        call puts
        jmp main_loop
.cls:   call cls
        jmp main_loop
.mem:   call cmd_mem
        jmp main_loop
.cpu:   call cmd_cpu
        jmp main_loop
.time:  call cmd_time
        jmp main_loop
.ver:   mov si, banner
        call puts
        jmp main_loop
.color: mov al, [attr]
        add al, 0x10
        and al, 0x7F
        or al, 0x0F
        mov [attr], al
        call cls
        jmp main_loop
.count: call cmd_count
        jmp main_loop
.reboot:
        int 0x19
        jmp 0xFFFF:0

; --- print string at SI using teletype ---
puts:
    push ax
.n: lodsb
    or al, al
    jz .d
    cmp al, 10
    jne .c
    call newline
    jmp .n
.c: mov ah, 0x0E
    mov bx, 0
    int 0x10
    jmp .n
.d: pop ax
    ret
newline:
    push ax
    mov ah, 0x0E
    mov al, 13
    int 0x10
    mov al, 10
    int 0x10
    pop ax
    ret
putc:
    mov ah, 0x0E
    xor bx, bx
    int 0x10
    ret
cls:
    mov ax, 0x0600
    mov bh, [attr]
    xor cx, cx
    mov dx, 0x184F
    int 0x10
    mov ah, 0x02
    xor bh, bh
    xor dx, dx
    int 0x10
    ret

; --- read line into linebuf (max 60) ---
readline:
    mov di, linebuf
    xor cx, cx
.k: xor ah, ah
    int 0x16
    cmp al, 13
    je .done
    cmp al, 8
    je .bs
    cmp al, 32
    jb .k
    cmp cx, 60
    jae .k
    cmp al, 'A'
    jb .st
    cmp al, 'Z'
    ja .st
    add al, 32
.st:stosb
    inc cx
    call putc
    jmp .k
.bs:jcxz .k
    dec di
    dec cx
    mov al, 8
    call putc
    mov al, ' '
    call putc
    mov al, 8
    call putc
    jmp .k
.done:
    mov byte [di], 0
    ret

; --- compare zero-terminated SI and DI; ZF=1 if equal ---
strcmp:
    push si
    push di
.c: mov al, [si]
    mov ah, [di]
    cmp al, ah
    jne .ne
    or al, al
    jz .eq
    inc si
    inc di
    jmp .c
.ne: pop di
    pop si
    or ax, 1     ; ensure ZF=0 (ax != 0 since al!=ah)
    cmp ax, 0
    ret
.eq: pop di
    pop si
    cmp ax, ax
    ret

; --- print AX as decimal ---
putdec:
    push ax
    push bx
    push cx
    push dx
    mov bx, 10
    xor cx, cx
.d: xor dx, dx
    div bx
    push dx
    inc cx
    or ax, ax
    jnz .d
.p: pop ax
    add al, '0'
    call putc
    loop .p
    pop dx
    pop cx
    pop bx
    pop ax
    ret
; --- print AL as 2-digit BCD ---
putbcd:
    push ax
    shr al, 4
    add al, '0'
    call putc
    pop ax
    and al, 0x0F
    add al, '0'
    call putc
    ret

cmd_mem:
    mov si, s_conv
    call puts
    int 0x12
    call putdec
    mov si, s_kb
    call puts
    ; extended memory via E801
    mov ax, 0xE801
    xor cx, cx
    xor dx, dx
    int 0x15
    jc .no
    jcxz .useax
    mov ax, cx
    mov bx, dx
.useax:
    ; AX = KB between 1M-16M, BX = 64K blocks above 16M
    push ax
    mov ax, bx
    shr ax, 4          ; 64K blocks /16 = MB
    pop cx
    shr cx, 10         ; KB -> MB
    add ax, cx
    add ax, 1
    mov si, s_ext
    call puts          ; puts clobbers BX, so compute first
    call putdec
    mov si, s_mb
    call puts
.no:ret

cmd_cpu:
    mov si, s_cpuv
    call puts
    xor eax, eax
    cpuid
    mov [cpubuf], ebx
    mov [cpubuf+4], edx
    mov [cpubuf+8], ecx
    mov byte [cpubuf+12], 0
    mov si, cpubuf
    call puts
    call newline
    ret

cmd_time:
    mov si, s_timev
    call puts
    mov ah, 0x02
    int 0x1A
    mov al, ch
    call putbcd
    mov al, ':'
    call putc
    mov al, cl
    call putbcd
    mov al, ':'
    call putc
    mov al, dh
    call putbcd
    call newline
    ret

; count to 30000 — shows the CPU is really executing instructions
cmd_count:
    mov si, s_counting
    call puts
    xor ax, ax
.l: inc ax
    test ax, 0x0FFF
    jnz .s
    push ax
    mov al, '.'
    call putc
    pop ax
.s: cmp ax, 60000
    jb .l
    call newline
    mov si, s_done
    call puts
    ret

attr db 0x1F
banner db "VPC Boot Monitor 1.0  -  real x86 code running in the v86 emulator", 10
       db "(c) Virtual PC project. Type HELP for commands.", 10, 10, 0
hint db 10, 0
prompt db "VPC> ", 0
unknown db "Unknown command. Type HELP.", 10, 0
helptxt db "HELP    this list", 10
        db "CLS     clear screen", 10
        db "MEM     detected memory (BIOS INT 12h / INT 15h E801)", 10
        db "CPU     CPU vendor (CPUID)", 10
        db "TIME    real-time clock (INT 1Ah)", 10
        db "COUNT   busy loop counting to 60000", 10
        db "COLOR   change colors", 10
        db "VER     version", 10
        db "REBOOT  restart the virtual machine", 10, 0
s_help db "help",0
s_cls db "cls",0
s_mem db "mem",0
s_cpu db "cpu",0
s_time db "time",0
s_reboot db "reboot",0
s_color db "color",0
s_ver db "ver",0
s_count db "count",0
s_conv db "Conventional memory: ",0
s_kb db " KB", 10, 0
s_ext db "Total memory: ",0
s_mb db " MB", 10, 0
s_cpuv db "CPU vendor: ",0
s_timev db "RTC time: ",0
s_counting db "Counting",0
s_done db "Done.",10,0
cpubuf times 16 db 0
linebuf times 64 db 0

times 17*512-($-$$) db 0
