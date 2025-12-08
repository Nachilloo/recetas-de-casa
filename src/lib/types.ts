// Tipos generados desde el schema de Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      recetas: {
        Row: {
          id: string
          title: string
          slug: string
          categoria: string
          dificultad: string
          tiempo: string
          porciones: number
          imagen: string
          imagen_alt: string | null
          descripcion: string | null
          historia: string | null
          ingredientes: string[]
          pasos: string[]
          tips: string[] | null
          tags: string[] | null
          calorias: number | null
          destacada: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          categoria: string
          dificultad: string
          tiempo: string
          porciones: number
          imagen: string
          imagen_alt?: string | null
          descripcion?: string | null
          historia?: string | null
          ingredientes: string[]
          pasos: string[]
          tips?: string[] | null
          tags?: string[] | null
          calorias?: number | null
          destacada?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          categoria?: string
          dificultad?: string
          tiempo?: string
          porciones?: number
          imagen?: string
          imagen_alt?: string | null
          descripcion?: string | null
          historia?: string | null
          ingredientes?: string[]
          pasos?: string[]
          tips?: string[] | null
          tags?: string[] | null
          calorias?: number | null
          destacada?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Tipos helper para usar en la aplicación
export type Receta = Database['public']['Tables']['recetas']['Row'];
export type RecetaInsert = Database['public']['Tables']['recetas']['Insert'];
export type RecetaUpdate = Database['public']['Tables']['recetas']['Update'];

