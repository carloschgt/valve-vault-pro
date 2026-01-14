export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      auth_events: {
        Row: {
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event_type: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key: string
          window_start: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key: string
          window_start?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      catalogo_produtos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          data_inativacao: string | null
          descricao: string
          id: string
          inativado_por: string | null
          peso_kg: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          data_inativacao?: string | null
          descricao: string
          id?: string
          inativado_por?: string | null
          peso_kg?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          data_inativacao?: string | null
          descricao?: string
          id?: string
          inativado_por?: string | null
          peso_kg?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      enderecos_materiais: {
        Row: {
          ativo: boolean
          codigo: string
          coluna: number
          comentario: string | null
          created_at: string
          created_by: string
          data_inativacao: string | null
          descricao: string
          descricao_imex: string | null
          fabricante_id: string | null
          id: string
          inativado_por: string | null
          nivel: number
          peso: number
          posicao: number
          rua: number
          tipo_material: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          coluna: number
          comentario?: string | null
          created_at?: string
          created_by: string
          data_inativacao?: string | null
          descricao: string
          descricao_imex?: string | null
          fabricante_id?: string | null
          id?: string
          inativado_por?: string | null
          nivel: number
          peso: number
          posicao: number
          rua: number
          tipo_material: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          coluna?: number
          comentario?: string | null
          created_at?: string
          created_by?: string
          data_inativacao?: string | null
          descricao?: string
          descricao_imex?: string | null
          fabricante_id?: string | null
          id?: string
          inativado_por?: string | null
          nivel?: number
          peso?: number
          posicao?: number
          rua?: number
          tipo_material?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_materiais_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricantes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabricantes: {
        Row: {
          cadastrado_por: string
          codigo: string
          data_cadastro: string
          id: string
          nome: string
        }
        Insert: {
          cadastrado_por?: string
          codigo: string
          data_cadastro?: string
          id?: string
          nome: string
        }
        Update: {
          cadastrado_por?: string
          codigo?: string
          data_cadastro?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      inventario: {
        Row: {
          comentario: string | null
          contado_por: string
          contagem_num: number
          created_at: string
          endereco_material_id: string
          id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          contado_por: string
          contagem_num?: number
          created_at?: string
          endereco_material_id: string
          id?: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          contado_por?: string
          contagem_num?: number
          created_at?: string
          endereco_material_id?: string
          id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_endereco_material_id_fkey"
            columns: ["endereco_material_id"]
            isOneToOne: false
            referencedRelation: "enderecos_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_audit: {
        Row: {
          editado_em: string
          editado_por: string
          id: string
          inventario_id: string
          motivo: string
          quantidade_anterior: number
          quantidade_nova: number
        }
        Insert: {
          editado_em?: string
          editado_por: string
          id?: string
          inventario_id: string
          motivo: string
          quantidade_anterior: number
          quantidade_nova: number
        }
        Update: {
          editado_em?: string
          editado_por?: string
          id?: string
          inventario_id?: string
          motivo?: string
          quantidade_anterior?: number
          quantidade_nova?: number
        }
        Relationships: []
      }
      inventario_config: {
        Row: {
          bloquear_visualizacao_estoque: boolean
          contagem_ativa: number
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bloquear_visualizacao_estoque?: boolean
          contagem_ativa?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bloquear_visualizacao_estoque?: boolean
          contagem_ativa?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inventario_config_rua: {
        Row: {
          contagem_ativa: number
          id: string
          rua: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contagem_ativa?: number
          id?: string
          rua: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contagem_ativa?: number
          id?: string
          rua?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inventario_selecao: {
        Row: {
          contagem_num: number
          created_at: string
          created_by: string
          endereco_material_id: string
          id: string
          rua: number
        }
        Insert: {
          contagem_num: number
          created_at?: string
          created_by: string
          endereco_material_id: string
          id?: string
          rua: number
        }
        Update: {
          contagem_num?: number
          created_at?: string
          created_by?: string
          endereco_material_id?: string
          id?: string
          rua?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventario_selecao_endereco_material_id_fkey"
            columns: ["endereco_material_id"]
            isOneToOne: false
            referencedRelation: "enderecos_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          device_info: string | null
          id: string
          logged_at: string
          user_email: string
          user_id: string
          user_nome: string
        }
        Insert: {
          device_info?: string | null
          id?: string
          logged_at?: string
          user_email: string
          user_id: string
          user_nome: string
        }
        Update: {
          device_info?: string | null
          id?: string
          logged_at?: string
          user_email?: string
          user_id?: string
          user_nome?: string
        }
        Relationships: []
      }
      notificacoes_usuario: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      password_change_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          expires_at: string | null
          id: string
          reason: string | null
          requested_by_user_id: string | null
          status: string
          target_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id?: string | null
          status?: string
          target_user_id: string
          type: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id?: string | null
          status?: string
          target_user_id?: string
          type?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          menu_key: string
          profile_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_key: string
          profile_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_key?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_tokens: {
        Row: {
          created_at: string
          device_info: string | null
          expires_at: string
          id: string
          ip: string | null
          last_seen_at: string | null
          revoked_at: string | null
          token: string
          token_hash: string | null
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          expires_at: string
          id?: string
          ip?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          token: string
          token_hash?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          expires_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          token?: string
          token_hash?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes_codigo: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_id: string | null
          codigo_gerado: string | null
          created_at: string
          descricao: string
          fabricante_id: string | null
          id: string
          locked_at: string | null
          locked_by_id: string | null
          motivo_rejeicao: string | null
          numero_solicitacao: number
          peso: number | null
          processado_em: string | null
          processado_por: string | null
          processado_por_id: string | null
          solicitado_por: string
          solicitado_por_id: string
          status: string
          tipo_material: string | null
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_id?: string | null
          codigo_gerado?: string | null
          created_at?: string
          descricao: string
          fabricante_id?: string | null
          id?: string
          locked_at?: string | null
          locked_by_id?: string | null
          motivo_rejeicao?: string | null
          numero_solicitacao?: number
          peso?: number | null
          processado_em?: string | null
          processado_por?: string | null
          processado_por_id?: string | null
          solicitado_por: string
          solicitado_por_id: string
          status?: string
          tipo_material?: string | null
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_id?: string | null
          codigo_gerado?: string | null
          created_at?: string
          descricao?: string
          fabricante_id?: string | null
          id?: string
          locked_at?: string | null
          locked_by_id?: string | null
          motivo_rejeicao?: string | null
          numero_solicitacao?: number
          peso?: number | null
          processado_em?: string | null
          processado_por?: string | null
          processado_por_id?: string | null
          solicitado_por?: string
          solicitado_por_id?: string
          status?: string
          tipo_material?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_codigo_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricantes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean
          is_system: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          aprovado: boolean
          created_at: string
          email: string
          failed_attempts: number
          force_password_change: boolean
          id: string
          is_active: boolean
          last_login_at: string | null
          last_login_ip: string | null
          locked_until: string | null
          nome: string
          notificado_aprovacao: boolean
          password_algo: string | null
          password_iterations: number | null
          password_salt: string | null
          password_updated_at: string | null
          role: string
          senha_hash: string
          status: Database["public"]["Enums"]["user_status"]
          suspenso_ate: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          aprovado?: boolean
          created_at?: string
          email: string
          failed_attempts?: number
          force_password_change?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          nome: string
          notificado_aprovacao?: boolean
          password_algo?: string | null
          password_iterations?: number | null
          password_salt?: string | null
          password_updated_at?: string | null
          role?: string
          senha_hash: string
          status?: Database["public"]["Enums"]["user_status"]
          suspenso_ate?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          aprovado?: boolean
          created_at?: string
          email?: string
          failed_attempts?: number
          force_password_change?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          nome?: string
          notificado_aprovacao?: boolean
          password_algo?: string | null
          password_iterations?: number | null
          password_salt?: string | null
          password_updated_at?: string | null
          role?: string
          senha_hash?: string
          status?: Database["public"]["Enums"]["user_status"]
          suspenso_ate?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          public_key: string
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          public_key: string
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_expired_sessions_v2: { Args: never; Returns: undefined }
      get_user_id_by_email: { Args: { user_email: string }; Returns: string }
      is_admin_user: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      user_status: "pendente" | "ativo" | "suspenso" | "negado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_status: ["pendente", "ativo", "suspenso", "negado"],
    },
  },
} as const
