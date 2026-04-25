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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bitacora_auditoria: {
        Row: {
          accion: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          fecha_registro: string | null
          id_bitacora: number
          id_registro: string
          tabla_afectada: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          fecha_registro?: string | null
          id_bitacora?: never
          id_registro: string
          tabla_afectada: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          fecha_registro?: string | null
          id_bitacora?: never
          id_registro?: string
          tabla_afectada?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      cliente: {
        Row: {
          auth_id: string | null
          created_at: string | null
          email: string | null
          es_registrado: boolean | null
          id_cliente: number
          lada: string | null
          nombre_completo: string
          push_token: string | null
          telefono: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string | null
          email?: string | null
          es_registrado?: boolean | null
          id_cliente?: never
          lada?: string | null
          nombre_completo: string
          push_token?: string | null
          telefono: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string | null
          email?: string | null
          es_registrado?: boolean | null
          id_cliente?: never
          lada?: string | null
          nombre_completo?: string
          push_token?: string | null
          telefono?: string
        }
        Relationships: []
      }
      descuento: {
        Row: {
          activo: boolean | null
          aplica_comprador: boolean | null
          cantidad_minima_boletos: number | null
          created_at: string | null
          es_default: boolean | null
          id_descuento: number
          id_paquete_condicion: number | null
          nombre: string
          porcentaje: number
        }
        Insert: {
          activo?: boolean | null
          aplica_comprador?: boolean | null
          cantidad_minima_boletos?: number | null
          created_at?: string | null
          es_default?: boolean | null
          id_descuento?: never
          id_paquete_condicion?: number | null
          nombre: string
          porcentaje: number
        }
        Update: {
          activo?: boolean | null
          aplica_comprador?: boolean | null
          cantidad_minima_boletos?: number | null
          created_at?: string | null
          es_default?: boolean | null
          id_descuento?: never
          id_paquete_condicion?: number | null
          nombre?: string
          porcentaje?: number
        }
        Relationships: [
          {
            foreignKeyName: "descuento_id_paquete_condicion_fkey"
            columns: ["id_paquete_condicion"]
            isOneToOne: false
            referencedRelation: "paquete"
            referencedColumns: ["id_paquete"]
          },
        ]
      }
      detalle_reservacion: {
        Row: {
          cantidad: number
          id_detalle: number
          id_paquete: number | null
          id_reservacion: number | null
        }
        Insert: {
          cantidad?: number
          id_detalle?: never
          id_paquete?: number | null
          id_reservacion?: number | null
        }
        Update: {
          cantidad?: number
          id_detalle?: never
          id_paquete?: number | null
          id_reservacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "detalle_reservacion_id_paquete_fkey"
            columns: ["id_paquete"]
            isOneToOne: false
            referencedRelation: "paquete"
            referencedColumns: ["id_paquete"]
          },
          {
            foreignKeyName: "detalle_reservacion_id_reservacion_fkey"
            columns: ["id_reservacion"]
            isOneToOne: false
            referencedRelation: "reservacion"
            referencedColumns: ["id_reservacion"]
          },
        ]
      }
      embarcacion: {
        Row: {
          capacidad_maxima: number
          duracion_estandar_viaje: number | null
          estado_operativo:
            | Database["public"]["Enums"]["estado_operativo_barco"]
            | null
          id_embarcacion: number
          margen_tolerancia_minutos: number | null
          matricula: string | null
          nombre: string
          tripulacion_default: string[] | null
        }
        Insert: {
          capacidad_maxima: number
          duracion_estandar_viaje?: number | null
          estado_operativo?:
            | Database["public"]["Enums"]["estado_operativo_barco"]
            | null
          id_embarcacion?: never
          margen_tolerancia_minutos?: number | null
          matricula?: string | null
          nombre: string
          tripulacion_default?: string[] | null
        }
        Update: {
          capacidad_maxima?: number
          duracion_estandar_viaje?: number | null
          estado_operativo?:
            | Database["public"]["Enums"]["estado_operativo_barco"]
            | null
          id_embarcacion?: never
          margen_tolerancia_minutos?: number | null
          matricula?: string | null
          nombre?: string
          tripulacion_default?: string[] | null
        }
        Relationships: []
      }
      pago: {
        Row: {
          fecha_pago: string | null
          id_pago: number
          id_reservacion: number
          metodo_pago: string
          monto_pagado: number
          numero_cuenta: string | null
          tipo_cuenta: string | null
        }
        Insert: {
          fecha_pago?: string | null
          id_pago?: never
          id_reservacion: number
          metodo_pago: string
          monto_pagado: number
          numero_cuenta?: string | null
          tipo_cuenta?: string | null
        }
        Update: {
          fecha_pago?: string | null
          id_pago?: never
          id_reservacion?: number
          metodo_pago?: string
          monto_pagado?: number
          numero_cuenta?: string | null
          tipo_cuenta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pago_id_reservacion_fkey"
            columns: ["id_reservacion"]
            isOneToOne: false
            referencedRelation: "reservacion"
            referencedColumns: ["id_reservacion"]
          },
        ]
      }
      paquete: {
        Row: {
          costo_persona: number
          descripcion: string
          id_paquete: number
          nombre: string | null
        }
        Insert: {
          costo_persona: number
          descripcion: string
          id_paquete?: never
          nombre?: string | null
        }
        Update: {
          costo_persona?: number
          descripcion?: string
          id_paquete?: never
          nombre?: string | null
        }
        Relationships: []
      }
      reservacion: {
        Row: {
          cantidad_personas: number
          codigo_qr: string | null
          created_at: string | null
          descuento_aplicado: number | null
          es_reubicacion: boolean | null
          estado_pago: string | null
          estado_pase:
            | Database["public"]["Enums"]["estado_pase_reservacion"]
            | null
          id_cliente: number
          id_paquete: number | null
          id_reservacion: number
          id_vendedor: string | null
          id_viaje: number
          pin_verificacion: string | null
          reservacion_original_id: number | null
          subtotal: number
          total_pagar: number
        }
        Insert: {
          cantidad_personas: number
          codigo_qr?: string | null
          created_at?: string | null
          descuento_aplicado?: number | null
          es_reubicacion?: boolean | null
          estado_pago?: string | null
          estado_pase?:
            | Database["public"]["Enums"]["estado_pase_reservacion"]
            | null
          id_cliente: number
          id_paquete?: number | null
          id_reservacion?: never
          id_vendedor?: string | null
          id_viaje: number
          pin_verificacion?: string | null
          reservacion_original_id?: number | null
          subtotal: number
          total_pagar: number
        }
        Update: {
          cantidad_personas?: number
          codigo_qr?: string | null
          created_at?: string | null
          descuento_aplicado?: number | null
          es_reubicacion?: boolean | null
          estado_pago?: string | null
          estado_pase?:
            | Database["public"]["Enums"]["estado_pase_reservacion"]
            | null
          id_cliente?: number
          id_paquete?: number | null
          id_reservacion?: never
          id_vendedor?: string | null
          id_viaje?: number
          pin_verificacion?: string | null
          reservacion_original_id?: number | null
          subtotal?: number
          total_pagar?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservacion_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "reservacion_id_paquete_fkey"
            columns: ["id_paquete"]
            isOneToOne: false
            referencedRelation: "paquete"
            referencedColumns: ["id_paquete"]
          },
          {
            foreignKeyName: "reservacion_id_vendedor_fkey"
            columns: ["id_vendedor"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id_usuario"]
          },
          {
            foreignKeyName: "reservacion_id_viaje_fkey"
            columns: ["id_viaje"]
            isOneToOne: false
            referencedRelation: "viaje"
            referencedColumns: ["id_viaje"]
          },
          {
            foreignKeyName: "reservacion_id_viaje_fkey"
            columns: ["id_viaje"]
            isOneToOne: false
            referencedRelation: "vista_operativa_viajes"
            referencedColumns: ["id_viaje"]
          },
          {
            foreignKeyName: "reservacion_reservacion_original_id_fkey"
            columns: ["reservacion_original_id"]
            isOneToOne: false
            referencedRelation: "reservacion"
            referencedColumns: ["id_reservacion"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          email: string | null
          id_embarcacion: number | null
          id_usuario: string
          nombre: string
          numero: string | null
          rango: Database["public"]["Enums"]["rango_usuario"]
        }
        Insert: {
          activo?: boolean
          email?: string | null
          id_embarcacion?: number | null
          id_usuario: string
          nombre: string
          numero?: string | null
          rango: Database["public"]["Enums"]["rango_usuario"]
        }
        Update: {
          activo?: boolean
          email?: string | null
          id_embarcacion?: number | null
          id_usuario?: string
          nombre?: string
          numero?: string | null
          rango?: Database["public"]["Enums"]["rango_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "usuario_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "embarcacion"
            referencedColumns: ["id_embarcacion"]
          },
          {
            foreignKeyName: "usuario_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "vista_estadisticas_barcos"
            referencedColumns: ["id_embarcacion"]
          },
        ]
      }
      viaje: {
        Row: {
          clima_estado: string | null
          clima_oleaje_m: number | null
          clima_viento_kmh: number | null
          created_at: string | null
          es_ultima_vuelta: boolean | null
          estado_viaje:
            | Database["public"]["Enums"]["estado_viaje_itinerario"]
            | null
          fecha_programada: string
          hora_inicio_abordaje: string | null
          hora_llegada_real: string | null
          hora_salida_programada: string
          hora_salida_real: string | null
          id_embarcacion: number
          id_encargado_abordaje: string | null
          id_viaje: number
          motivo_alteracion: string | null
          notificado_llegada: boolean | null
          notificado_salida: boolean | null
          retraso_minutos: number | null
          tiempo_estimado_regreso: string | null
          tripulacion_asignada: string[] | null
        }
        Insert: {
          clima_estado?: string | null
          clima_oleaje_m?: number | null
          clima_viento_kmh?: number | null
          created_at?: string | null
          es_ultima_vuelta?: boolean | null
          estado_viaje?:
            | Database["public"]["Enums"]["estado_viaje_itinerario"]
            | null
          fecha_programada: string
          hora_inicio_abordaje?: string | null
          hora_llegada_real?: string | null
          hora_salida_programada: string
          hora_salida_real?: string | null
          id_embarcacion: number
          id_encargado_abordaje?: string | null
          id_viaje?: never
          motivo_alteracion?: string | null
          notificado_llegada?: boolean | null
          notificado_salida?: boolean | null
          retraso_minutos?: number | null
          tiempo_estimado_regreso?: string | null
          tripulacion_asignada?: string[] | null
        }
        Update: {
          clima_estado?: string | null
          clima_oleaje_m?: number | null
          clima_viento_kmh?: number | null
          created_at?: string | null
          es_ultima_vuelta?: boolean | null
          estado_viaje?:
            | Database["public"]["Enums"]["estado_viaje_itinerario"]
            | null
          fecha_programada?: string
          hora_inicio_abordaje?: string | null
          hora_llegada_real?: string | null
          hora_salida_programada?: string
          hora_salida_real?: string | null
          id_embarcacion?: number
          id_encargado_abordaje?: string | null
          id_viaje?: never
          motivo_alteracion?: string | null
          notificado_llegada?: boolean | null
          notificado_salida?: boolean | null
          retraso_minutos?: number | null
          tiempo_estimado_regreso?: string | null
          tripulacion_asignada?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "viaje_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "embarcacion"
            referencedColumns: ["id_embarcacion"]
          },
          {
            foreignKeyName: "viaje_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "vista_estadisticas_barcos"
            referencedColumns: ["id_embarcacion"]
          },
          {
            foreignKeyName: "viaje_id_encargado_abordaje_fkey"
            columns: ["id_encargado_abordaje"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
    }
    Views: {
      vista_estadisticas_barcos: {
        Row: {
          barco_nombre: string | null
          estado_operativo:
            | Database["public"]["Enums"]["estado_operativo_barco"]
            | null
          id_embarcacion: number | null
          paquete_rey: string | null
          peak_hour: number | null
          total_boletos: number | null
          total_ingresos: number | null
          total_pax: number | null
          viajes_realizados: number | null
        }
        Relationships: []
      }
      vista_estadisticas_barcos_detalladas: {
        Row: {
          hora_pico: number | null
          id_embarcacion: number | null
          ingresos_totales: number | null
          nombre_barco: string | null
          total_pasajeros: number | null
          total_viajes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "viaje_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "embarcacion"
            referencedColumns: ["id_embarcacion"]
          },
          {
            foreignKeyName: "viaje_id_embarcacion_fkey"
            columns: ["id_embarcacion"]
            isOneToOne: false
            referencedRelation: "vista_estadisticas_barcos"
            referencedColumns: ["id_embarcacion"]
          },
        ]
      }
      vista_estadisticas_diarias: {
        Row: {
          fecha: string | null
          paquete_top: string | null
          total_ingresos: number | null
          total_pax: number | null
          total_viajes: number | null
          vendedor_top: string | null
          viajes_cancelados: number | null
        }
        Relationships: []
      }
      vista_estadisticas_metodos_pago: {
        Row: {
          metodo_pago: string | null
          total_ingresos: number | null
          total_transacciones: number | null
        }
        Relationships: []
      }
      vista_estadisticas_vendedores: {
        Row: {
          id_vendedor: string | null
          peak_hour: number | null
          rango: string | null
          top_barco: string | null
          total_boletos: number | null
          total_ingresos: number | null
          total_pax: number | null
          vendedor_nombre: string | null
        }
        Relationships: []
      }
      vista_kpi_operativos: {
        Row: {
          eficiencia_puntualidad_pct: number | null
          mes: string | null
          promedio_retraso_minutos: number | null
          racha_viento_maxima_registrada: number | null
          total_viajes_programados: number | null
        }
        Relationships: []
      }
      vista_operativa_viajes: {
        Row: {
          clima_estado: string | null
          clima_viento_kmh: number | null
          estado_viaje:
            | Database["public"]["Enums"]["estado_viaje_itinerario"]
            | null
          fecha_programada: string | null
          hora_limite_zarpe: string | null
          hora_llegada_real: string | null
          hora_salida_programada: string | null
          hora_salida_real: string | null
          id_viaje: number | null
          margen_tolerancia_minutos: number | null
          monto_total: number | null
          nombre_barco: string | null
          ocupados: number | null
          retraso_minutos: number | null
          tiempo_estimado_regreso: string | null
        }
        Relationships: []
      }
      vista_tendencias_semanales: {
        Row: {
          fecha: string | null
          total_ingresos: number | null
          total_pax: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      actualizar_clima_viajes: { Args: never; Returns: Json }
      obtener_mi_rango: {
        Args: never
        Returns: Database["public"]["Enums"]["rango_usuario"]
      }
    }
    Enums: {
      estado_operativo_barco: "Activo" | "Mantenimiento" | "Inactivo"
      estado_pase_reservacion:
        | "Pendiente_Caseta"
        | "Aprobado"
        | "Rechazado"
        | "Abordado"
        | "Vencido"
      estado_viaje_itinerario:
        | "Programado"
        | "Retrasado"
        | "Abordando"
        | "En_Navegacion"
        | "Finalizado"
        | "Cancelado"
      rango_usuario: "Vendedor" | "Caseta" | "Barco" | "Comprador" | "Dev"
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
      estado_operativo_barco: ["Activo", "Mantenimiento", "Inactivo"],
      estado_pase_reservacion: [
        "Pendiente_Caseta",
        "Aprobado",
        "Rechazado",
        "Abordado",
        "Vencido",
      ],
      estado_viaje_itinerario: [
        "Programado",
        "Retrasado",
        "Abordando",
        "En_Navegacion",
        "Finalizado",
        "Cancelado",
      ],
      rango_usuario: ["Vendedor", "Caseta", "Barco", "Comprador", "Dev"],
    },
  },
} as const

export type Descuento = Database['public']['Tables']['descuento']['Row'];
export type Usuario = Database['public']['Tables']['usuario']['Row'];
export type Embarcacion = Database['public']['Tables']['embarcacion']['Row'];
export type Paquete = Database['public']['Tables']['paquete']['Row'];
export type Viaje = Database['public']['Tables']['viaje']['Row'];
export type Pago = Database['public']['Tables']['pago']['Row'];
export type PagoInsert = Database['public']['Tables']['pago']['Insert'];
export type EstadoViaje = Database['public']['Enums']['estado_viaje_itinerario'];
export type RangoUsuario = Database['public']['Enums']['rango_usuario'];
export type Reservacion = Database['public']['Tables']['reservacion']['Row'];
export type ReservacionInsert = Database['public']['Tables']['reservacion']['Insert'];
export type Cliente = Database['public']['Tables']['cliente']['Row'];

export type ReservacionConDetalles = Reservacion & {
  cliente: Cliente | null;
  paquete: Paquete | null;
  viaje: (Viaje & { embarcacion: Embarcacion | null }) | null;
  pago: Pago[] | null;
  detalle_reservacion: (Tables<'detalle_reservacion'> & {
    paquete: Paquete | null;
  })[] | null;
  nombre_cliente_manual?: string; // For older rows or manual entry
};
