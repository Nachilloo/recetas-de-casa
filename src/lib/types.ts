// Tipos generados desde el schema de Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Plan = 'free' | 'trial' | 'pro';

export interface Database {
  public: {
    Tables: {
      recetas: {
        Row: {
          id: string
          title: string
          slug: string
          categoria: string
          categorias: string[] | null
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
          guia_casera: string | null
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
          categorias?: string[] | null
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
          guia_casera?: string | null
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
          categorias?: string[] | null
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
          guia_casera?: string | null
          tags?: string[] | null
          calorias?: number | null
          destacada?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          is_public: boolean
          plan: Plan
          trial_started_at: string | null
          trial_ends_at: string | null
          trial_used_at: string | null
          pro_renews_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          is_public?: boolean
          plan?: Plan
          trial_started_at?: string | null
          trial_ends_at?: string | null
          trial_used_at?: string | null
          pro_renews_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          is_public?: boolean
          plan?: Plan
          trial_started_at?: string | null
          trial_ends_at?: string | null
          trial_used_at?: string | null
          pro_renews_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      favoritos: {
        Row: {
          user_id: string
          receta_slug: string
          created_at: string
        }
        Insert: {
          user_id: string
          receta_slug: string
          created_at?: string
        }
        Update: {
          user_id?: string
          receta_slug?: string
          created_at?: string
        }
      }
      colecciones: {
        Row: {
          id: string
          user_id: string
          nombre: string
          descripcion: string | null
          slugs: string[]
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nombre: string
          descripcion?: string | null
          slugs?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre?: string
          descripcion?: string | null
          slugs?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      menu_usage: {
        Row: {
          id: string
          user_id: string
          used_at: string
          plan_at_time: Plan
        }
        Insert: {
          id?: string
          user_id: string
          used_at?: string
          plan_at_time: Plan
        }
        Update: {
          id?: string
          user_id?: string
          used_at?: string
          plan_at_time?: Plan
        }
      }
      sugerencias: {
        Row: {
          id: string
          created_at: string
          tipo: string
          email: string | null
          mensaje: string
          user_id: string | null
          page_url: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          tipo: string
          email?: string | null
          mensaje: string
          user_id?: string | null
          page_url?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          tipo?: string
          email?: string | null
          mensaje?: string
          user_id?: string | null
          page_url?: string | null
          user_agent?: string | null
        }
      }
      pin_history: {
        Row: {
          id: string
          receta_slug: string
          posted_at: string
          pinterest_pin_id: string | null
          board_id: string | null
          pin_title: string | null
          pin_url: string | null
          status: 'posted' | 'failed'
          error_message: string | null
        }
        Insert: {
          id?: string
          receta_slug: string
          posted_at?: string
          pinterest_pin_id?: string | null
          board_id?: string | null
          pin_title?: string | null
          pin_url?: string | null
          status?: 'posted' | 'failed'
          error_message?: string | null
        }
        Update: {
          id?: string
          receta_slug?: string
          posted_at?: string
          pinterest_pin_id?: string | null
          board_id?: string | null
          pin_title?: string | null
          pin_url?: string | null
          status?: 'posted' | 'failed'
          error_message?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      puede_generar_menu: {
        Args: { p_user_id: string }
        Returns: boolean
      }
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

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Favorito = Database['public']['Tables']['favoritos']['Row'];
export type Coleccion = Database['public']['Tables']['colecciones']['Row'];
export type ColeccionInsert = Database['public']['Tables']['colecciones']['Insert'];

export type MenuUsage = Database['public']['Tables']['menu_usage']['Row'];
export type PinHistory = Database['public']['Tables']['pin_history']['Row'];
export type PinHistoryInsert = Database['public']['Tables']['pin_history']['Insert'];

/** Estado consolidado de un usuario para chequeos de gating en UI. */
export interface PlanStatus {
  plan: Plan;
  /** Trial activo (no caducado) */
  trialActive: boolean;
  /** Días restantes de trial. Negativo si caducó. Null si no está en trial. */
  trialDaysLeft: number | null;
  /** ¿Ya usó su trial alguna vez? (bloquea reintento) */
  trialUsed: boolean;
  /** ¿Puede generar un menú con IA ahora mismo? */
  canGenerateMenu: boolean;
  /** Si es free y aún tiene cuota: null. Si no la tiene, fecha en la que vuelve a tenerla. */
  menuCooldownUntil: string | null;
}
