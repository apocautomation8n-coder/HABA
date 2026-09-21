"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  ChevronDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  CustomCategoryItem,
  getAllProductCategories,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  getCategoryBadge,
} from "@/lib/products";
import { matchesSearch } from "@/lib/search";

interface CategorySelectorProps {
  value: string;
  onChange: (categoryLabel: string) => void;
  existingProducts?: { description?: string | null }[];
  supabase?: any;
  error?: string;
  onCategoriesChanged?: () => void;
}

const EMOJI_OPTIONS = ["🏷️", "✨", "🎨", "🧵", "✂️", "🕯️", "🏺", "🧁", "📦", "🌿", "💍", "👜", "📓"];

export function CategorySelector({
  value,
  onChange,
  existingProducts,
  supabase,
  error,
  onCategoriesChanged,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<CustomCategoryItem[]>([]);

  // Estado para crear nueva categoría in-line
  const [isCreating, setIsCreating] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");

  // Estado para editar categoría in-line
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  // Estado para confirmar eliminación
  const [deletingCat, setDeletingCat] = useState<CustomCategoryItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar categorías iniciales
  const loadCategories = () => {
    const list = getAllProductCategories(existingProducts);
    setCategories(list);
  };

  useEffect(() => {
    loadCategories();
  }, [existingProducts]);

  // Click outside para cerrar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingCatId(null);
        setDeletingCat(null);
        setSearch("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus en el search cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Categoría seleccionada actual
  const selectedBadge = useMemo(() => {
    return getCategoryBadge(value);
  }, [value]);

  // Filtrado de categorías
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    return categories.filter((c) =>
      matchesSearch([c.label, c.icon], search)
    );
  }, [categories, search]);

  // Guardar nueva categoría
  const handleCreateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const newCat = createProductCategory(trimmed, newCatIcon);
    loadCategories();
    onChange(newCat.label);
    setNewCatName("");
    setIsCreating(false);
    setIsOpen(false);
    onCategoriesChanged?.();
  };

  // Guardar edición de categoría
  const handleEditSubmit = async (cat: CustomCategoryItem) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingCatId(null);
      return;
    }

    setIsProcessing(true);
    try {
      await updateProductCategory(cat.label, trimmed, editIcon || cat.icon, supabase);
      loadCategories();

      // Si la categoría editada era la seleccionada, actualizar selección
      if (value.toLowerCase() === cat.label.toLowerCase()) {
        onChange(trimmed);
      }

      setEditingCatId(null);
      onCategoriesChanged?.();
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar eliminación
  const handleDeleteConfirm = async () => {
    if (!deletingCat) return;

    setIsProcessing(true);
    try {
      await deleteProductCategory(deletingCat.label, supabase, "Otro");
      loadCategories();

      // Si la categoría eliminada era la que estaba seleccionada, cambiar a "Otro"
      if (value.toLowerCase() === deletingCat.label.toLowerCase()) {
        onChange("Otro");
      }

      setDeletingCat(null);
      onCategoriesChanged?.();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Botón Trigger del Selector */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-2.5 bg-neutral-50 hover:bg-neutral-100/80 border rounded-2xl flex items-center justify-between transition group shadow-2xs ${
          error
            ? "border-rose-300 ring-2 ring-rose-100"
            : isOpen
            ? "border-[#3BB578] ring-2 ring-[#DCF4D7] bg-white"
            : "border-neutral-200"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ backgroundColor: selectedBadge.bgColor }}
          >
            {selectedBadge.icon}
          </div>
          <div className="text-left truncate">
            <span className="text-xs font-bold text-neutral-800 block truncate">
              {selectedBadge.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-600 transition flex-shrink-0">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#3BB578]" : ""
            }`}
          />
        </div>
      </button>

      {/* Menú Desplegable Enriquecido */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-neutral-200/90 shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header con Buscador */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/60">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar o crear categoría..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578] transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-neutral-400 hover:text-neutral-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Formulario in-line de Nueva Categoría */}
          {isCreating ? (
            <div className="p-3 bg-[#F0FAF4] border-b border-[#DCF4D7] space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#1F7A4C]">
                <span>Nueva Categoría de Producto</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewCatName("");
                  }}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Selector de Emoji */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewCatIcon(em)}
                    className={`w-6 h-6 rounded-lg text-sm flex items-center justify-center flex-shrink-0 transition ${
                      newCatIcon === em
                        ? "bg-[#3BB578] text-white shadow-2xs scale-110"
                        : "bg-white hover:bg-neutral-100 border border-neutral-200/80"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateSubmit();
                    }
                  }}
                  placeholder="Ej: Sublimación & Estampados"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:border-[#3BB578]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleCreateSubmit()}
                  disabled={!newCatName.trim()}
                  className="px-3 py-1.5 bg-[#3BB578] hover:bg-[#2E9E65] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-1.5 border-b border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  if (search.trim()) setNewCatName(search.trim());
                }}
                className="w-full py-1.5 px-2.5 text-xs font-bold text-[#1F7A4C] hover:bg-[#DCF4D7]/40 rounded-xl flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva categoría {search.trim() ? `"${search.trim()}"` : ""}</span>
              </button>
            </div>
          )}

          {/* Diálogo de Confirmación de Eliminación */}
          {deletingCat && (
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-start gap-2 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">¿Eliminar categoría "{deletingCat.label}"?</p>
                  <p className="text-[10px] text-rose-600 leading-tight mt-0.5">
                    Los productos asociados se reasignarán automáticamente a "Otro" sin perder datos.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingCat(null)}
                  disabled={isProcessing}
                  className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-600 rounded-lg text-[11px] font-semibold border border-neutral-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-xs"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  <span>Eliminar y Reasignar</span>
                </button>
              </div>
            </div>
          )}

          {/* Lista de Categorías */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400">
                No se encontraron categorías.
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected =
                  value.toLowerCase() === cat.label.toLowerCase() ||
                  value.toLowerCase() === cat.id.toLowerCase();
                const isEditing = editingCatId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-1.5 bg-[#F0FAF4] rounded-xl border border-[#3BB578] flex items-center gap-1.5 animate-in fade-in-50 duration-150"
                    >
                      <input
                        type="text"
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="w-7 text-center text-sm py-1 bg-white border border-neutral-200 rounded-lg outline-none"
                        maxLength={2}
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleEditSubmit(cat);
                          }
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:border-[#3BB578]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleEditSubmit(cat)}
                        className="p-1 bg-[#3BB578] text-white rounded-lg hover:bg-[#2E9E65] transition"
                        title="Guardar cambios"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg transition"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className={`group w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-[#DCF4D7]/70 text-[#1F7A4C] font-bold"
                        : "hover:bg-neutral-100 text-neutral-700"
                    }`}
                    onClick={() => {
                      onChange(cat.label);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0">{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                      {cat.isCustom && (
                        <span className="text-[9px] bg-neutral-200 text-neutral-600 px-1.5 py-0.2 rounded font-normal flex-shrink-0">
                          Personalizada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#1F7A4C] mr-1" />
                      )}

                      {/* Botones de acción rápida en hover (Editar y Eliminar) */}
                      <div
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCatId(cat.id);
                            setEditName(cat.label);
                            setEditIcon(cat.icon);
                          }}
                          className="p-1 text-neutral-400 hover:text-[#1F7A4C] hover:bg-white rounded-md transition"
                          title="Renombrar categoría"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {cat.label.toLowerCase() !== "otro" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCat(cat);
                            }}
                            className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
