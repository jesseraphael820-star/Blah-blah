# TheoTown - Editor de Dinheiro

Programa para Windows que muda o dinheiro da sua cidade no TheoTown (single-player).
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

## Compilar

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o TheoTownDinheiro.exe .
```
