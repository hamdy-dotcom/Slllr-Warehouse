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
      arrival_edits: {
        Row: {
          arrival_id: string
          created_at: string
          edited_by: string | null
          id: string
          new_arrived_on: string | null
          new_note: string | null
          new_qty: number
          new_reference: string | null
          old_arrived_on: string | null
          old_note: string | null
          old_qty: number
          old_reference: string | null
          product_id: string
          reason: string | null
          request_id: string
        }
        Insert: {
          arrival_id: string
          created_at?: string
          edited_by?: string | null
          id?: string
          new_arrived_on?: string | null
          new_note?: string | null
          new_qty: number
          new_reference?: string | null
          old_arrived_on?: string | null
          old_note?: string | null
          old_qty: number
          old_reference?: string | null
          product_id: string
          reason?: string | null
          request_id: string
        }
        Update: {
          arrival_id?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          new_arrived_on?: string | null
          new_note?: string | null
          new_qty?: number
          new_reference?: string | null
          old_arrived_on?: string | null
          old_note?: string | null
          old_qty?: number
          old_reference?: string | null
          product_id?: string
          reason?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrival_edits_arrival_id_fkey"
            columns: ["arrival_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["arrival_id"]
          },
          {
            foreignKeyName: "arrival_edits_arrival_id_fkey"
            columns: ["arrival_id"]
            isOneToOne: false
            referencedRelation: "arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrival_edits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrival_edits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrival_edits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "arrival_edits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "arrival_edits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_request_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_edits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["po_id"]
          },
        ]
      }
      arrivals: {
        Row: {
          arrived_on: string
          created_at: string
          edited_count: number
          id: string
          note: string | null
          product_id: string
          qty: number
          received_by: string | null
          reference: string | null
          request_id: string
          supplier_id: string
          unit_cost: number | null
          value: number | null
          voided: boolean
        }
        Insert: {
          arrived_on?: string
          created_at?: string
          edited_count?: number
          id?: string
          note?: string | null
          product_id: string
          qty: number
          received_by?: string | null
          reference?: string | null
          request_id: string
          supplier_id: string
          unit_cost?: number | null
          value?: number | null
          voided?: boolean
        }
        Update: {
          arrived_on?: string
          created_at?: string
          edited_count?: number
          id?: string
          note?: string | null
          product_id?: string
          qty?: number
          received_by?: string | null
          reference?: string | null
          request_id?: string
          supplier_id?: string
          unit_cost?: number | null
          value?: number | null
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "arrivals_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "arrivals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "arrivals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_request_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "arrivals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "arrivals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrivals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sku: string
          supplier_id: string
          total_qty: number
          unit_cost: number | null
          updated_at: string
          warehouse_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sku: string
          supplier_id: string
          total_qty?: number
          unit_cost?: number | null
          updated_at?: string
          warehouse_code: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sku?: string
          supplier_id?: string
          total_qty?: number
          unit_cost?: number | null
          updated_at?: string
          warehouse_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      reserve_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string
          note: string | null
          product_id: string
          qty_approved: number | null
          qty_arrived: number
          qty_cancelled: number
          qty_released: number
          qty_requested: number
          qty_returned: number
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hold_until?: string | null
          id?: string
          note?: string | null
          product_id: string
          qty_approved?: number | null
          qty_arrived?: number
          qty_cancelled?: number
          qty_released?: number
          qty_requested: number
          qty_returned?: number
          requested_by: string
          status?: Database["public"]["Enums"]["request_status"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hold_until?: string | null
          id?: string
          note?: string | null
          product_id?: string
          qty_approved?: number | null
          qty_arrived?: number
          qty_cancelled?: number
          qty_released?: number
          qty_requested?: number
          qty_returned?: number
          requested_by?: string
          status?: Database["public"]["Enums"]["request_status"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["settlement_kind"]
          movement_id: string
          note: string | null
          occurred_on: string
          product_id: string
          qty: number
          reference: string | null
          supplier_id: string
          unit_cost: number | null
          value: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["settlement_kind"]
          movement_id: string
          note?: string | null
          occurred_on?: string
          product_id: string
          qty: number
          reference?: string | null
          supplier_id: string
          unit_cost?: number | null
          value?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["settlement_kind"]
          movement_id?: string
          note?: string | null
          occurred_on?: string
          product_id?: string
          qty?: number
          reference?: string | null
          supplier_id?: string
          unit_cost?: number | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "settlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "settlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "settlements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "settlements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor: string | null
          created_at: string
          delta: number
          direction: Database["public"]["Enums"]["movement_direction"]
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note: string | null
          product_id: string
          qty_after: number
          qty_settled: number
          reason: string
          reference: string | null
          request_id: string | null
          unit_cost: number | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          delta: number
          direction: Database["public"]["Enums"]["movement_direction"]
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          product_id: string
          qty_after: number
          qty_settled?: number
          reason: string
          reference?: string | null
          request_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          delta?: number
          direction?: Database["public"]["Enums"]["movement_direction"]
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          product_id?: string
          qty_after?: number
          qty_settled?: number
          reason?: string
          reference?: string | null
          request_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_request_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reserve_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["po_id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          note: string | null
          paid_on: string
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_on?: string
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_on?: string
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      arrival_edit_log: {
        Row: {
          arrival_id: string | null
          created_at: string | null
          delta: number | null
          edited_by_name: string | null
          id: string | null
          new_arrived_on: string | null
          new_note: string | null
          new_qty: number | null
          new_reference: string | null
          old_arrived_on: string | null
          old_note: string | null
          old_qty: number | null
          old_reference: string | null
          po_ref: string | null
          product_name: string | null
          reason: string | null
          sku: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrival_edits_arrival_id_fkey"
            columns: ["arrival_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["arrival_id"]
          },
          {
            foreignKeyName: "arrival_edits_arrival_id_fkey"
            columns: ["arrival_id"]
            isOneToOne: false
            referencedRelation: "arrivals"
            referencedColumns: ["id"]
          },
        ]
      }
      arrival_log: {
        Row: {
          arrival_id: string | null
          arrived_on: string | null
          edited_count: number | null
          image_url: string | null
          note: string | null
          po_id: string | null
          po_ref: string | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          qty_approved: number | null
          qty_arrived: number | null
          qty_locked_by_dispatch: number | null
          qty_still_awaiting: number | null
          received_by_name: string | null
          recorded_at: string | null
          reference: string | null
          sku: string | null
          supplier_name: string | null
          unit_cost: number | null
          value: number | null
          voided: boolean | null
          warehouse_code: string | null
        }
        Relationships: []
      }
      po_settlement: {
        Row: {
          awaiting_transfer_value: number | null
          cancelled_value: number | null
          delivered_value: number | null
          image_url: string | null
          in_warehouse_value: number | null
          out_for_delivery_value: number | null
          pct_arrived: number | null
          pct_delivered: number | null
          pct_out_for_delivery: number | null
          po_date: string | null
          po_id: string | null
          po_ref: string | null
          po_status: string | null
          po_value: number | null
          product_id: string | null
          product_name: string | null
          qty_approved: number | null
          qty_arrived: number | null
          qty_awaiting_transfer: number | null
          qty_cancelled: number | null
          qty_delivered: number | null
          qty_dispatched_total: number | null
          qty_in_warehouse: number | null
          qty_out_for_delivery: number | null
          qty_requested: number | null
          qty_returned: number | null
          queue_position: number | null
          request_status: Database["public"]["Enums"]["request_status"] | null
          returned_value: number | null
          sku: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      product_stock: {
        Row: {
          created_at: string | null
          free_qty: number | null
          id: string | null
          image_url: string | null
          in_progress_qty: number | null
          is_active: boolean | null
          name: string | null
          pending_qty: number | null
          reserved_qty: number | null
          riyadh_qty: number | null
          sku: string | null
          stock_value: number | null
          supplier_id: string | null
          total_qty: number | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_wallet"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      reserve_request_dispatch: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string | null
          note: string | null
          outstanding_value: number | null
          product_id: string | null
          qty_approved: number | null
          qty_cancelled: number | null
          qty_dispatched_total: number | null
          qty_outstanding: number | null
          qty_requested: number | null
          qty_returned: number | null
          requested_by: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hold_until?: string | null
          id?: string | null
          note?: string | null
          outstanding_value?: never
          product_id?: string | null
          qty_approved?: number | null
          qty_cancelled?: number | null
          qty_dispatched_total?: number | null
          qty_outstanding?: never
          qty_requested?: number | null
          qty_returned?: number | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hold_until?: string | null
          id?: string | null
          note?: string | null
          outstanding_value?: never
          product_id?: string | null
          qty_approved?: number | null
          qty_cancelled?: number | null
          qty_dispatched_total?: number | null
          qty_outstanding?: never
          qty_requested?: number | null
          qty_returned?: number | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "arrival_log"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "po_settlement"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "transfer_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reserve_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_wallet: {
        Row: {
          balance: number | null
          delivered_qty: number | null
          delivered_value: number | null
          in_progress_qty: number | null
          in_progress_value: number | null
          paid_total: number | null
          returned_qty: number | null
          returned_value: number | null
          supplier_id: string | null
          supplier_name: string | null
        }
        Relationships: []
      }
      transfer_queue: {
        Row: {
          approved_at: string | null
          awaiting_transfer_value: number | null
          image_url: string | null
          po_date: string | null
          po_id: string | null
          po_ref: string | null
          product_id: string | null
          product_name: string | null
          qty_approved: number | null
          qty_arrived: number | null
          qty_awaiting_transfer: number | null
          qty_cancelled: number | null
          sku: string | null
          supplier_id: string | null
          supplier_name: string | null
          transfer_status: string | null
          unit_cost: number | null
          warehouse_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      amend_arrival: {
        Args: {
          p_arrival_id: string
          p_arrived_on?: string
          p_note?: string
          p_qty?: number
          p_reason?: string
          p_reference?: string
        }
        Returns: {
          arrived_on: string
          created_at: string
          edited_count: number
          id: string
          note: string | null
          product_id: string
          qty: number
          received_by: string | null
          reference: string | null
          request_id: string
          supplier_id: string
          unit_cost: number | null
          value: number | null
          voided: boolean
        }
        SetofOptions: {
          from: "*"
          to: "arrivals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_reserve_request: {
        Args: { p_note?: string; p_qty?: number; p_request_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string
          note: string | null
          product_id: string
          qty_approved: number | null
          qty_arrived: number
          qty_cancelled: number
          qty_released: number
          qty_requested: number
          qty_returned: number
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          unit_cost: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reserve_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_create_products: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          sku: string
        }[]
      }
      bulk_update_stock: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          sku: string
        }[]
      }
      consume_reserve_request: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string
          note: string | null
          product_id: string
          qty_approved: number | null
          qty_arrived: number
          qty_cancelled: number
          qty_released: number
          qty_requested: number
          qty_returned: number
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          unit_cost: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reserve_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_reserve_request: {
        Args: {
          p_hold_until?: string
          p_note?: string
          p_product_id: string
          p_qty: number
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string
          note: string | null
          product_id: string
          qty_approved: number | null
          qty_arrived: number
          qty_cancelled: number
          qty_released: number
          qty_requested: number
          qty_returned: number
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          unit_cost: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reserve_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      my_supplier: { Args: never; Returns: string }
      record_arrivals: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          po_ref: string
        }[]
      }
      record_settlements: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          sku: string
        }[]
      }
      record_stock_movements: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          sku: string
        }[]
      }
      record_supplier_payment: {
        Args: {
          p_amount: number
          p_method?: string
          p_note?: string
          p_paid_on?: string
          p_reference?: string
          p_supplier_id: string
        }
        Returns: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          note: string | null
          paid_on: string
          reference: string | null
          supplier_id: string
        }
        SetofOptions: {
          from: "*"
          to: "supplier_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_reserve_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hold_until: string | null
          id: string
          note: string | null
          product_id: string
          qty_approved: number | null
          qty_arrived: number
          qty_cancelled: number
          qty_released: number
          qty_requested: number
          qty_returned: number
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          unit_cost: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reserve_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_reserved_qty: {
        Args: { p_rows: Json }
        Returns: {
          message: string
          ok: boolean
          sku: string
        }[]
      }
    }
    Enums: {
      app_role: "sllr" | "supplier" | "admin" | "warehouse"
      movement_direction: "in" | "out"
      movement_kind:
        | "purchase"
        | "return"
        | "correction"
        | "release_sllr"
        | "sale_other"
        | "damage"
        | "transfer_riyadh"
      request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "consumed"
      settlement_kind: "delivered" | "returned"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["sllr", "supplier", "admin", "warehouse"],
      movement_direction: ["in", "out"],
      movement_kind: [
        "purchase",
        "return",
        "correction",
        "release_sllr",
        "sale_other",
        "damage",
        "transfer_riyadh",
      ],
      request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "consumed",
      ],
      settlement_kind: ["delivered", "returned"],
    },
  },
} as const
