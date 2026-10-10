import { NextResponse } from "next/server";
import { ReelPublishRequest, ReelPublishResponse } from "@/types/reel";

/**
 * Endpoint para processamento e agendamento de Reels.
 * 
 * NOTA: A integração direta com a Meta Graph API ainda não está ativa.
 * Quando ativada, este endpoint realizará o fluxo oficial da Meta:
 * 1. POST /{ig-user-id}/media
 *    - media_type: "REELS"
 *    - video_url: URL pública do vídeo
 *    - caption: Legenda do Reel
 *    -> Retorna container_id
 * 2. GET /{container-id}?fields=status_code
 *    -> Aguarda status "FINISHED"
 * 3. POST /{ig-user-id}/media_publish?creation_id={container-id}
 *    -> Publica oficialmente o Reel no Instagram
 */
export async function POST(request: Request) {
  try {
    const body: ReelPublishRequest = await request.json();

    if (!body.videoUrl || typeof body.videoUrl !== "string") {
      return NextResponse.json(
        { success: false, message: "A URL do vídeo é obrigatória." },
        { status: 400 }
      );
    }

    // Validação básica de URL
    try {
      new URL(body.videoUrl);
    } catch {
      return NextResponse.json(
        { success: false, message: "A URL do vídeo fornecida não é válida." },
        { status: 400 }
      );
    }

    if (body.caption && body.caption.length > 2200) {
      return NextResponse.json(
        { success: false, message: "A legenda excede o limite de 2.200 caracteres do Instagram." },
        { status: 400 }
      );
    }

    // Simulação do ID de container da Meta Graph API
    const mockContainerId = `sim_container_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const responseData: ReelPublishResponse = {
      success: true,
      message: "Reel validado e pronto para publicação! (Modo de simulação ativo)",
      containerId: mockContainerId,
      creationTime: new Date().toISOString(),
      data: {
        videoUrl: body.videoUrl,
        caption: body.caption || "",
        status: body.scheduledTime ? "scheduled" : "simulated",
        scheduledTime: body.scheduledTime || null,
      },
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Erro ao processar publicação do Reel:", error);
    return NextResponse.json(
      { success: false, message: "Ocorreu um erro interno ao processar a solicitação." },
      { status: 500 }
    );
  }
}
