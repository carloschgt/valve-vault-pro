/**
 * Formata endereço no padrão Rxx.Cxx.Nxx.Pxx (com zero à esquerda)
 */
export function formatEndereco(rua: number, coluna: number, nivel: number, posicao: number): string {
  return `R${String(rua).padStart(2, '0')}.C${String(coluna).padStart(2, '0')}.N${String(nivel).padStart(2, '0')}.P${String(posicao).padStart(2, '0')}`;
}

/**
 * Formata endereço a partir de um objeto com os campos
 */
export function formatEnderecoFromObj(endereco: { rua: number; coluna: number; nivel: number; posicao: number }): string {
  return formatEndereco(endereco.rua, endereco.coluna, endereco.nivel, endereco.posicao);
}
