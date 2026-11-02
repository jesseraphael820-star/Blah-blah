#!/usr/bin/env bash
# Rebuilds www/images/vpc-linux.bzImage: Linux 6.8 (i386) with an embedded
# BusyBox initramfs. Tested on Ubuntu 24.04 (needs root for apt + mknod).
#   sudo bash os/linux/build-kernel.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../.."
WORK="${WORK:-/tmp/vpc-linux-build}"
mkdir -p "$WORK" && cd "$WORK"

apt-get install -y build-essential flex bison bc libelf-dev libssl-dev cpio xz-utils linux-source-6.8.0
dpkg --add-architecture i386 && apt-get update
apt-get download busybox-static:i386
rm -rf bb && dpkg -x busybox-static_*_i386.deb bb

# root file system
rm -rf rootfs && mkdir -p rootfs/{bin,sbin,etc,proc,sys,dev,tmp,root,mnt/host,usr/bin,usr/sbin,usr/share/udhcpc,home}
cp bb/usr/bin/busybox rootfs/bin/
cp "$HERE/init" rootfs/init && chmod +x rootfs/init
cp "$HERE/udhcpc.script" rootfs/usr/share/udhcpc/default.script && chmod +x rootfs/usr/share/udhcpc/default.script
printf '%s\n' 'export PS1="\[\e[1;32m\]vpc@linux\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]# "' 'alias ll="ls -la"' > rootfs/etc/profile
echo "root:x:0:0:root:/root:/bin/sh" > rootfs/etc/passwd
echo "root:x:0:" > rootfs/etc/group
echo "Bem-vindo ao Linux do Virtual PC." > rootfs/root/LEIA-ME.txt
mknod -m 600 rootfs/dev/console c 5 1
mknod -m 666 rootfs/dev/null c 1 3

# kernel
[ -d linux-source-6.8.0 ] || tar xjf /usr/src/linux-source-6.8.0/linux-source-6.8.0.tar.bz2
cd linux-source-6.8.0
cp "$HERE/kernel.config" .config
scripts/config --set-str INITRAMFS_SOURCE "$WORK/rootfs"
make ARCH=i386 olddefconfig
make ARCH=i386 -j"$(nproc)" bzImage
cp arch/x86/boot/bzImage "$ROOT/www/images/vpc-linux.bzImage"
echo "OK: $ROOT/www/images/vpc-linux.bzImage"
