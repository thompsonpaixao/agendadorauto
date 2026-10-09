"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MonitoringFolder, MonitoredProfile } from "@/types";
import { useToast } from "@/context/ToastContext";
import {
  FolderPlus,
  UserPlus,
  Folder,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Info,
  Trash2,
  Loader2,
  FolderEdit,
  ChevronRight,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { Modal } from "@/components/ui/Modal";

export default function MonitoramentoPage() {
  const { addToast } = useToast();

  const [folders, setFolders] = useState<MonitoringFolder[]>([]);
  const [profiles, setProfiles] = useState<MonitoredProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");

  // Modais de Criação
  const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newFolderId, setNewFolderId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Modal de Criação de Pasta
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366F1");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Modais de Exclusão
  const [profileToDelete, setProfileToDelete] = useState<MonitoredProfile | null>(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  const [folderToDelete, setFolderToDelete] = useState<MonitoringFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  // Carregar dados reais da API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [foldersRes, profilesRes] = await Promise.all([
        fetch("/api/monitoring/folders"),
        fetch("/api/monitoring/profiles"),
      ]);

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        if (foldersData.success && Array.isArray(foldersData.folders)) {
          setFolders(foldersData.folders);
        }
      }

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        if (profilesData.success && Array.isArray(profilesData.profiles)) {
          setProfiles(profilesData.profiles);
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar monitoramento:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Criar Perfil Real
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    setIsCreatingProfile(true);
    try {
      const res = await fetch("/api/monitoring/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.replace("@", "").trim(),
          displayName: newDisplayName.trim(),
          notes: newNotes.trim(),
          folderId: newFolderId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao adicionar perfil.");
      }

      addToast({
        type: "success",
        title: "Perfil Cadastrado",
        message: `@${data.profile.username} foi adicionado à lista de monitoramento.`,
      });

      setIsAddProfileModalOpen(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewNotes("");
      setNewFolderId("");
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      addToast({
        type: "error",
        title: "Falha ao Adicionar Perfil",
        message: msg,
      });
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Criar Pasta Real
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const res = await fetch("/api/monitoring/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: newFolderDesc.trim(),
          color: newFolderColor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao criar pasta.");
      }

      addToast({
        type: "success",
        title: "Pasta Criada",
        message: `Nicho "${data.folder.name}" criado com sucesso.`,
      });

      setIsAddFolderModalOpen(false);
      setNewFolderName("");
      setNewFolderDesc("");
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      addToast({
        type: "error",
        title: "Falha ao Criar Pasta",
        message: msg,
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Mover Perfil entre Pastas
  const handleMoveProfileFolder = async (profileId: string, targetFolderId: string) => {
    try {
      const res = await fetch(`/api/monitoring/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: targetFolderId === "none" ? null : targetFolderId,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível mover o perfil.");
      }

      addToast({
        type: "success",
        title: "Pasta Atualizada",
        message: "O perfil foi movido para a pasta selecionada.",
      });

      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao mover";
      addToast({ type: "error", title: "Erro ao Mover", message: msg });
    }
  };

  // Excluir Perfil
  const executeDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeletingProfile(true);
    try {
      const res = await fetch(`/api/monitoring/profiles/${profileToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao remover perfil.");

      addToast({
        type: "info",
        title: "Perfil Removido",
        message: `@${profileToDelete.username} foi removido do monitoramento.`,
      });
      setProfileToDelete(null);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover";
      addToast({ type: "error", title: "Falha na Exclusão", message: msg });
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // Excluir Pasta
  const executeDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsDeletingFolder(true);
    try {
      const res = await fetch(`/api/monitoring/folders/${folderToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao remover pasta.");

      addToast({
        type: "info",
        title: "Pasta Excluída",
        message: `A pasta "${folderToDelete.name}" foi removida. Os perfis associados foram preservados.`,
      });
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId("all");
      }
      setFolderToDelete(null);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover";
      addToast({ type: "error", title: "Falha na Exclusão", message: msg });
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const filteredProfiles = selectedFolderId === "all"
    ? profiles
    : profiles.filter((p) => p.folderId === selectedFolderId);

  return (
    <div className="space-y-6">
      {/* Topo: Título & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Perfis Monitorados
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Acompanhe contas públicas de referência organizadas por nichos e pastas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddFolderModalOpen(true)}
            className="py-2.5 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            <span>Nova Pasta</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddProfileModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar Perfil</span>
          </button>
        </div>
      </div>

      {/* Banner de Conformidade Técnica Meta */}
      <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex items-start gap-3.5 text-xs text-indigo-900">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">Política Oficial de Monitoramento (Sem Scraping)</div>
          <p className="text-indigo-800/90 leading-relaxed">
            O AgendadorAuto não utiliza automação de navegador, Selenium ou scraping não autorizado.
            A sincronização de métricas e conteúdo público respeita os termos de serviço da Meta.
            Histórico retido em até 30 dias de snapshots sem armazenamento de arquivos de mídia de terceiros.
          </p>
        </div>
      </div>

      {/* Seletor de Pastas / Nichos */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            Nichos:
          </span>

          <button
            type="button"
            onClick={() => setSelectedFolderId("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              selectedFolderId === "all"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Todos ({profiles.length})
          </button>

          {folders.map((folder) => {
            const count = profiles.filter((p) => p.folderId === folder.id).length;
            return (
              <div key={folder.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    selectedFolderId === folder.id
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: folder.color || "#6366F1" }}
                  />
                  <span>{folder.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
                {selectedFolderId === folder.id && (
                  <button
                    type="button"
                    onClick={() => setFolderToDelete(folder)}
                    className="ml-1 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Excluir pasta"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid de Perfis Monitorados com Estado Real */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Carregando perfis monitorados...</p>
        </div>
      ) : profiles.length === 0 ? (
        /* Estado Real: Vazio sem mocks */
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <InstagramIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">Nenhum perfil monitorado ainda</h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Cadastre perfis públicos do Instagram para acompanhar referências de formato, ritmo de postagens e tendências do seu nicho.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddFolderModalOpen(true)}
              className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Criar Pasta
            </button>
            <button
              type="button"
              onClick={() => setIsAddProfileModalOpen(true)}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              Adicionar Primeiro Perfil
            </button>
          </div>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <Folder className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhum perfil nesta pasta</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Mova perfis existentes para esta pasta ou adicione um novo perfil vinculando-o diretamente a ela.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/10 to-indigo-500/10 border border-pink-200/60 flex items-center justify-center shrink-0">
                      <InstagramIcon className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">@{item.username}</h4>
                      <p className="text-xs text-slate-500">{item.displayName}</p>
                    </div>
                  </div>

                  <a
                    href={item.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Abrir perfil oficial no Instagram"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Pasta e Notas */}
                <div className="mt-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Pasta:</span>
                    <select
                      value={item.folderId || "none"}
                      onChange={(e) => handleMoveProfileFolder(item.id, e.target.value)}
                      className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700 focus:outline-none"
                    >
                      <option value="none">Sem pasta</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {item.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed italic">
                      "{item.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Card */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" /> Cadastrado
                </span>
                <button
                  type="button"
                  onClick={() => setProfileToDelete(item)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remover perfil monitorado"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADICIONAR NOVO PERFIL */}
      {isAddProfileModalOpen && (
        <Modal
          isOpen={isAddProfileModalOpen}
          onClose={() => !isCreatingProfile && setIsAddProfileModalOpen(false)}
          title="Adicionar Perfil para Monitoramento"
          description="Cadastre um perfil público de referência do Instagram."
        >
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome de Usuário (@username) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ex: perfil_referencia"
                  className="w-full pl-7 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome de Exibição (Opcional)
              </label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="ex: Canal de Treinos"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pasta / Nicho
              </label>
              <select
                value={newFolderId}
                onChange={(e) => setNewFolderId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-700"
              >
                <option value="">Nenhuma pasta (Geral)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notas Estratégicas (Opcional)
              </label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="ex: Ideias de formatos para Reels curtos..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isCreatingProfile}
                onClick={() => setIsAddProfileModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingProfile || !newUsername.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isCreatingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Adicionar Perfil</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: CRIAR NOVA PASTA */}
      {isAddFolderModalOpen && (
        <Modal
          isOpen={isAddFolderModalOpen}
          onClose={() => !isCreatingFolder && setIsAddFolderModalOpen(false)}
          title="Criar Nova Pasta / Nicho"
          description="Agrupe perfis de referência por tópicos ou categorias."
        >
          <form onSubmit={handleCreateFolder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Pasta *
              </label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="ex: Fitness, Finanças, Concorrentes..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                placeholder="ex: Perfis que produzem conteúdo educativo"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                {["#6366F1", "#10B981", "#EC4899", "#F59E0B", "#8B5CF6", "#06B6D4"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      newFolderColor === c ? "scale-110 border-slate-900 shadow-xs" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isCreatingFolder}
                onClick={() => setIsAddFolderModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isCreatingFolder ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando...</span>
                  </>
                ) : (
                  <span>Criar Pasta</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA EXCLUIR PERFIL */}
      {profileToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(profileToDelete)}
          onClose={() => !isDeletingProfile && setProfileToDelete(null)}
          onConfirm={executeDeleteProfile}
          isDeleting={isDeletingProfile}
          title="Remover Perfil do Monitoramento"
          itemName={`@${profileToDelete.username}`}
          description="Tem certeza de que deseja remover este perfil? O histórico associado será apagado."
          warningNote="Esta ação remove o acompanhamento deste perfil da sua lista."
          confirmButtonText="Sim, remover perfil"
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA EXCLUIR PASTA */}
      {folderToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(folderToDelete)}
          onClose={() => !isDeletingFolder && setFolderToDelete(null)}
          onConfirm={executeDeleteFolder}
          isDeleting={isDeletingFolder}
          title="Excluir Pasta de Nicho"
          itemName={folderToDelete.name}
          description="Tem certeza de que deseja excluir esta pasta? Os perfis contidos nela não serão apagados, apenas ficarão sem pasta associada."
          warningNote="A pasta será removida permanentemente."
          confirmButtonText="Sim, excluir pasta"
        />
      )}
    </div>
  );
}
