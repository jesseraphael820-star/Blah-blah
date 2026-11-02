# TheoTown - Editor de Dinheiro

Programa para Windows e Android (com root) que muda o dinheiro da sua cidade no TheoTown (single-player).
Funciona como um "Cheat Engine" simplificado: acha o valor do dinheiro na memória do jogo e troca pelo valor que você digitar.

## Como usar

1. Abra o TheoTown e carregue sua cidade.
2. Execute `TheoTownDinheiro.exe` (se der erro de permissão, clique com o botão direito > **Executar como administrador**).
3. Digite o dinheiro **exato** que aparece no jogo.
4. Volte ao jogo, faça o dinheiro mudar (construa uma estrada, por exemplo) e digite o novo valor. Repita até o programa dizer "Dinheiro localizado".
5. Digite quanto dinheiro você quer. Pronto!
   - Opção **Congelar** mantém o dinheiro sempre nesse valor.

Dicas:
- Pause o jogo enquanto digita os valores, para o dinheiro não mudar sozinho.
- Valor máximo: 2.147.483.647.
- Use só em cidades offline — não use em regiões online/multiplayer.
- O Windows Defender/SmartScreen pode avisar, porque o programa mexe na memória de outro processo (é o mesmo motivo pelo qual ele avisa sobre o Cheat Engine). Clique em "Mais informações > Executar assim mesmo".

## Android (precisa de ROOT)

Sem root o Android não deixa nenhum app mexer na memória de outro app, então **só funciona em celular com root** (Magisk, KernelSU etc.).

1. Instale o **Termux** (pela F-Droid ou GitHub, a versão da Play Store é antiga).
2. Baixe o arquivo certo para o seu celular (quase todo celular atual é `arm64`):
   - `theotown-dinheiro-android-arm64` (celulares de 64 bits — o normal)
   - `theotown-dinheiro-android-arm32` (celulares antigos de 32 bits)
3. Abra o TheoTown, carregue a cidade e **pause** o jogo.
4. No Termux, digite (troque `arm64` por `arm32` se for o caso):
   ```
   su
   cp /sdcard/Download/theotown-dinheiro-android-arm64 /data/local/tmp/theotown-dinheiro
   chmod 755 /data/local/tmp/theotown-dinheiro
   /data/local/tmp/theotown-dinheiro
   ```
   O Magisk vai pedir permissão de root para o Termux — aceite.
5. Use igual ao PC: digite o dinheiro atual, mude o dinheiro no jogo, digite o novo valor, e por fim o valor que quer.
   Use a tela dividida (ou alterne entre os apps) para ver o jogo e o Termux.

Nas próximas vezes basta: `su -c /data/local/tmp/theotown-dinheiro`

## Compilar

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o TheoTownDinheiro.exe .
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o theotown-dinheiro-android-arm64 .
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -trimpath -ldflags="-s -w" -o theotown-dinheiro-android-arm32 .
```
