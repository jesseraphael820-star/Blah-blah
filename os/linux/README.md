# VPC Linux (imagem incluída)

`www/images/vpc-linux.bzImage` é um kernel Linux 6.8 (i386) com um initramfs
embutido contendo o BusyBox 1.36. Ele roda dentro da Máquina Virtual x86
(emulador v86) e monta a pasta compartilhada do Virtual PC em `/mnt/host`
(virtio-9p). Se a rede da VM estiver ativada, `eth0` (NE2000) é configurada via DHCP.

Fontes usados (GPL-2.0):
- Kernel: pacote Ubuntu `linux-source-6.8.0` (6.8.0-147), configuração em `kernel.config`.
- BusyBox: pacote Ubuntu `busybox-static:i386` (1:1.36.1-6ubuntu3.1), licença em `../licenses/busybox.copyright`.

Para recompilar: `sudo bash os/linux/build-kernel.sh`.
O código-fonte correspondente está disponível nos repositórios do Ubuntu
(`apt-get source linux-source-6.8.0 busybox`).
