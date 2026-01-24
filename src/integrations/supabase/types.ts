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
      area_separacao_resumo: {
        Row: {
          codigo_item: string
          id: string
          qtd_em_separacao: number
          updated_at: string
        }
        Insert: {
          codigo_item: string
          id?: string
          qtd_em_separacao?: number
          updated_at?: string
        }
        Update: {
          codigo_item?: string
          id?: string
          qtd_em_separacao?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      cancelamentos: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_id: string
          data_cancelamento: string
          id: string
          motivo: string | null
          pedido_cliente: string
          status: Database["public"]["Enums"]["status_cancelamento"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          criado_por_id: string
          data_cancelamento?: string
          id?: string
          motivo?: string | null
          pedido_cliente: string
          status?: Database["public"]["Enums"]["status_cancelamento"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_id?: string
          data_cancelamento?: string
          id?: string
          motivo?: string | null
          pedido_cliente?: string
          status?: Database["public"]["Enums"]["status_cancelamento"]
          updated_at?: string
        }
        Relationships: []
      }
      cancelamentos_linhas: {
        Row: {
          cancelamento_id: string
          codigo_item: string
          created_at: string
          fornecedor: string | null
          id: string
          qtd_cancelada: number
          qtd_devolvida_total: number
          status_linha: Database["public"]["Enums"]["status_linha_cancelamento"]
          updated_at: string
        }
        Insert: {
          cancelamento_id: string
          codigo_item: string
          created_at?: string
          fornecedor?: string | null
          id?: string
          qtd_cancelada: number
          qtd_devolvida_total?: number
          status_linha?: Database["public"]["Enums"]["status_linha_cancelamento"]
          updated_at?: string
        }
        Update: {
          cancelamento_id?: string
          codigo_item?: string
          created_at?: string
          fornecedor?: string | null
          id?: string
          qtd_cancelada?: number
          qtd_devolvida_total?: number
          status_linha?: Database["public"]["Enums"]["status_linha_cancelamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancelamentos_linhas_cancelamento_id_fkey"
            columns: ["cancelamento_id"]
            isOneToOne: false
            referencedRelation: "cancelamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_produtos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          data_inativacao: string | null
          descricao: string
          descricao_imex: string | null
          id: string
          inativado_por: string | null
          peso_kg: number | null
          updated_at: string
          valor_unitario: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          data_inativacao?: string | null
          descricao: string
          descricao_imex?: string | null
          id?: string
          inativado_por?: string | null
          peso_kg?: number | null
          updated_at?: string
          valor_unitario?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          data_inativacao?: string | null
          descricao?: string
          descricao_imex?: string | null
          id?: string
          inativado_por?: string | null
          peso_kg?: number | null
          updated_at?: string
          valor_unitario?: number | null
        }
        Relationships: []
      }
      devolucoes_alocacoes: {
        Row: {
          cancelamento_linha_id: string
          coluna: number
          created_at: string
          data_hora: string
          endereco_material_id: string
          id: string
          nivel: number
          posicao: number
          qtd_devolvida: number
          rua: number
          usuario_estoque: string
        }
        Insert: {
          cancelamento_linha_id: string
          coluna: number
          created_at?: string
          data_hora?: string
          endereco_material_id: string
          id?: string
          nivel: number
          posicao: number
          qtd_devolvida: number
          rua: number
          usuario_estoque: string
        }
        Update: {
          cancelamento_linha_id?: string
          coluna?: number
          created_at?: string
          data_hora?: string
          endereco_material_id?: string
          id?: string
          nivel?: number
          posicao?: number
          qtd_devolvida?: number
          rua?: number
          usuario_estoque?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolucoes_alocacoes_cancelamento_linha_id_fkey"
            columns: ["cancelamento_linha_id"]
            isOneToOne: false
            referencedRelation: "cancelamentos_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_alocacoes_endereco_material_id_fkey"
            columns: ["endereco_material_id"]
            isOneToOne: false
            referencedRelation: "enderecos_materiais"
            referencedColumns: ["id"]
          },
        ]
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
      enderecos_materiais_audit: {
        Row: {
          acao: string
          campo_alterado: string | null
          codigo: string
          created_at: string
          endereco_material_id: string
          id: string
          usuario_email: string
          usuario_id: string | null
          usuario_nome: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          campo_alterado?: string | null
          codigo: string
          created_at?: string
          endereco_material_id: string
          id?: string
          usuario_email: string
          usuario_id?: string | null
          usuario_nome: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          campo_alterado?: string | null
          codigo?: string
          created_at?: string
          endereco_material_id?: string
          id?: string
          usuario_email?: string
          usuario_id?: string | null
          usuario_nome?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      estoque_alocacoes: {
        Row: {
          codigo: string
          id: string
          local: string
          quantidade: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          codigo: string
          id?: string
          local: string
          quantidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          codigo?: string
          id?: string
          local?: string
          quantidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          codigo: string
          created_at: string
          criado_por: string
          destino_endereco_id: string | null
          destino_local: string
          id: string
          motivo: string | null
          nf_numero: string | null
          origem_endereco_id: string | null
          origem_local: string
          quantidade: number
          referencia: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          criado_por: string
          destino_endereco_id?: string | null
          destino_local: string
          id?: string
          motivo?: string | null
          nf_numero?: string | null
          origem_endereco_id?: string | null
          origem_local: string
          quantidade: number
          referencia?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          criado_por?: string
          destino_endereco_id?: string | null
          destino_local?: string
          id?: string
          motivo?: string | null
          nf_numero?: string | null
          origem_endereco_id?: string | null
          origem_local?: string
          quantidade?: number
          referencia?: string | null
        }
        Relationships: []
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
          qtd_reservada: number
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
          qtd_reservada?: number
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
          qtd_reservada?: number
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
      material_transactions: {
        Row: {
          codigo_item: string
          created_at: string
          data_hora: string
          endereco: string | null
          fornecedor: string | null
          id: string
          local: string | null
          observacao: string | null
          qtd: number
          referencia: string | null
          tipo_transacao: Database["public"]["Enums"]["tipo_transacao"]
          usuario: string
        }
        Insert: {
          codigo_item: string
          created_at?: string
          data_hora?: string
          endereco?: string | null
          fornecedor?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          qtd: number
          referencia?: string | null
          tipo_transacao: Database["public"]["Enums"]["tipo_transacao"]
          usuario: string
        }
        Update: {
          codigo_item?: string
          created_at?: string
          data_hora?: string
          endereco?: string | null
          fornecedor?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          qtd?: number
          referencia?: string | null
          tipo_transacao?: Database["public"]["Enums"]["tipo_transacao"]
          usuario?: string
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
      sep_alocacoes: {
        Row: {
          coluna: number
          created_at: string
          data_hora: string
          destino_local: string
          endereco_material_id: string
          id: string
          linha_id: string
          nivel: number
          posicao: number
          qtd_devolvida: number
          qtd_retirada: number
          rua: number
          status: Database["public"]["Enums"]["status_alocacao"]
          usuario_estoque: string
        }
        Insert: {
          coluna: number
          created_at?: string
          data_hora?: string
          destino_local?: string
          endereco_material_id: string
          id?: string
          linha_id: string
          nivel: number
          posicao: number
          qtd_devolvida?: number
          qtd_retirada: number
          rua: number
          status?: Database["public"]["Enums"]["status_alocacao"]
          usuario_estoque: string
        }
        Update: {
          coluna?: number
          created_at?: string
          data_hora?: string
          destino_local?: string
          endereco_material_id?: string
          id?: string
          linha_id?: string
          nivel?: number
          posicao?: number
          qtd_devolvida?: number
          qtd_retirada?: number
          rua?: number
          status?: Database["public"]["Enums"]["status_alocacao"]
          usuario_estoque?: string
        }
        Relationships: [
          {
            foreignKeyName: "sep_alocacoes_endereco_material_id_fkey"
            columns: ["endereco_material_id"]
            isOneToOne: false
            referencedRelation: "enderecos_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sep_alocacoes_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "sep_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      sep_linhas: {
        Row: {
          codigo_item: string
          created_at: string
          fornecedor: string | null
          id: string
          item_cliente: string | null
          obs_comercial: string | null
          obs_estoque: string | null
          pedido_cliente: string
          prioridade: number | null
          qtd_disponivel_snapshot: number | null
          qtd_reservada: number
          qtd_separada: number
          qtd_solicitada: number
          solicitacao_id: string
          status_linha: Database["public"]["Enums"]["status_linha_sep"]
          updated_at: string
        }
        Insert: {
          codigo_item: string
          created_at?: string
          fornecedor?: string | null
          id?: string
          item_cliente?: string | null
          obs_comercial?: string | null
          obs_estoque?: string | null
          pedido_cliente: string
          prioridade?: number | null
          qtd_disponivel_snapshot?: number | null
          qtd_reservada?: number
          qtd_separada?: number
          qtd_solicitada: number
          solicitacao_id: string
          status_linha?: Database["public"]["Enums"]["status_linha_sep"]
          updated_at?: string
        }
        Update: {
          codigo_item?: string
          created_at?: string
          fornecedor?: string | null
          id?: string
          item_cliente?: string | null
          obs_comercial?: string | null
          obs_estoque?: string | null
          pedido_cliente?: string
          prioridade?: number | null
          qtd_disponivel_snapshot?: number | null
          qtd_reservada?: number
          qtd_separada?: number
          qtd_solicitada?: number
          solicitacao_id?: string
          status_linha?: Database["public"]["Enums"]["status_linha_sep"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sep_linhas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "sep_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sep_solicitacoes: {
        Row: {
          codigo_lista: string
          created_at: string
          criado_por: string
          criado_por_id: string
          data_abertura: string | null
          data_conclusao: string | null
          data_inicio_estoque: string | null
          id: string
          observacoes_comercial: string | null
          observacoes_estoque: string | null
          status: Database["public"]["Enums"]["status_solicitacao"]
          updated_at: string
        }
        Insert: {
          codigo_lista: string
          created_at?: string
          criado_por: string
          criado_por_id: string
          data_abertura?: string | null
          data_conclusao?: string | null
          data_inicio_estoque?: string | null
          id?: string
          observacoes_comercial?: string | null
          observacoes_estoque?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          updated_at?: string
        }
        Update: {
          codigo_lista?: string
          created_at?: string
          criado_por?: string
          criado_por_id?: string
          data_abertura?: string | null
          data_conclusao?: string | null
          data_inicio_estoque?: string | null
          id?: string
          observacoes_comercial?: string | null
          observacoes_estoque?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          updated_at?: string
        }
        Relationships: []
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
          descricao_imex: string | null
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
          descricao_imex?: string | null
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
          descricao_imex?: string | null
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
      status_alocacao: "Reservado" | "Separado" | "Devolvido"
      status_cancelamento: "Aberto" | "EmProcesso" | "Concluido" | "Cancelado"
      status_linha_cancelamento:
        | "PendenteDevolucao"
        | "Devolvendo"
        | "DevolvidoTotal"
      status_linha_sep:
        | "Pendente"
        | "FaltaPrioridade"
        | "Separando"
        | "Parcial"
        | "Separado"
        | "CompraNecessaria"
        | "Cancelado"
      status_solicitacao:
        | "Rascunho"
        | "Enviada"
        | "EmSeparacao"
        | "Parcial"
        | "Concluida"
        | "Cancelada"
      tipo_transacao:
        | "RECEBIMENTO"
        | "ARMAZENAGEM_ENTRADA"
        | "RESERVA_SAIDA_ARMAZENAGEM"
        | "ENTRADA_AREA_SEPARACAO"
        | "SEPARACAO_INICIO"
        | "SEPARACAO_CONFIRMADA"
        | "SEPARACAO_FIM"
        | "CANCELAMENTO_CRIADO"
        | "SAIDA_AREA_SEPARACAO"
        | "DEVOLUCAO_ENTRADA_ARMAZENAGEM"
        | "AJUSTE"
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
      status_alocacao: ["Reservado", "Separado", "Devolvido"],
      status_cancelamento: ["Aberto", "EmProcesso", "Concluido", "Cancelado"],
      status_linha_cancelamento: [
        "PendenteDevolucao",
        "Devolvendo",
        "DevolvidoTotal",
      ],
      status_linha_sep: [
        "Pendente",
        "FaltaPrioridade",
        "Separando",
        "Parcial",
        "Separado",
        "CompraNecessaria",
        "Cancelado",
      ],
      status_solicitacao: [
        "Rascunho",
        "Enviada",
        "EmSeparacao",
        "Parcial",
        "Concluida",
        "Cancelada",
      ],
      tipo_transacao: [
        "RECEBIMENTO",
        "ARMAZENAGEM_ENTRADA",
        "RESERVA_SAIDA_ARMAZENAGEM",
        "ENTRADA_AREA_SEPARACAO",
        "SEPARACAO_INICIO",
        "SEPARACAO_CONFIRMADA",
        "SEPARACAO_FIM",
        "CANCELAMENTO_CRIADO",
        "SAIDA_AREA_SEPARACAO",
        "DEVOLUCAO_ENTRADA_ARMAZENAGEM",
        "AJUSTE",
      ],
      user_status: ["pendente", "ativo", "suspenso", "negado"],
    },
  },
} as const
