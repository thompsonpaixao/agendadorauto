/**
 * Alias de compatibilidade para a rota principal /api/instagram/connect
 * Garante que qualquer requisição direcionada a /api/instagram/auth execute o mesmo fluxo unificado.
 */
export { GET } from "@/app/api/instagram/connect/route";
