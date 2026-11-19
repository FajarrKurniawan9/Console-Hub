// Kontrak API UI console Gudang (/api/v1, token bearer akun lokal). Acuan backend.
// Harus sinkron dengan schemas.ts; pemeriksaan tipe di sana gagal bila menyimpang.

export type UiUser = { id: number; name: string; email: string };

export type ItemKind = 'BB' | 'BJ';            // bahan baku | barang jadi
export type ItemStatus = 'aktif' | 'nonaktif';

export type Item = {                           // data bersama, baca saja di UI ini
  id: string;                                  // UUID dari portal
  sku: string;                                 // SKU-BB-001 / SKU-BJ-001
  name: string;
  kind: ItemKind;
  unit: string;                                // pcs, kg, m, ...
  min_stock: number;
  status: ItemStatus;
  version: number;
  locked: boolean;                             // sedang diproses transaksi portal
  stock: { on_hand: number; reserved: number; available: number }; // total semua rak
};

export type ItemDetail = Item & {
  racks: Array<{ rack_id: string; rack_code: string; rack_name: string;
                 on_hand: number; reserved: number; available: number }>;
};

export type RackStatus = 'aktif' | 'nonaktif';
export type Rack = {
  id: string; code: string;                    // RAK-A1
  name: string; location: string | null;
  capacity: number | null;                     // satuan bebas, opsional
  status: RackStatus; version: number;
  item_count: number;                          // jumlah barang yang punya stok di rak ini
};

export type StockLine = {
  item_id: string; sku: string; item_name: string; unit: string;
  rack_id: string; rack_code: string;
  on_hand: number; reserved: number; available: number;
};

export type MovementType =
  | 'initial' | 'adjust_add' | 'adjust_correct' | 'reserve' | 'release' | 'consume';

export type StockMovement = {
  id: number; occurred_at: string;             // ISO 8601
  item_id: string; sku: string; item_name: string;
  rack_id: string | null; rack_code: string | null;
  type: MovementType;
  quantity: number;                            // bertanda: + menambah, - mengurangi stok tersedia
  balance_after: number;                       // on_hand setelah pergerakan
  reason: string | null;                       // wajib untuk adjust_*
  actor: string | null;                        // nama staf atau "Sistem"
  order_code: string | null;                   // untuk reserve/release/consume
};

export type ReservationStatus = 'aktif' | 'dilepas' | 'dipakai';
export type Reservation = {
  id: string; order_code: string;
  item_id: string; sku: string; item_name: string;
  quantity: number; status: ReservationStatus;
  created_at: string; closed_at: string | null;
};

export type AreaAccess = {
  employee_nik: string; employee_name: string; area: string;
  granted_at: string; revoked_at: string | null;
};

export type LogEntry = {
  id: number; occurred_at: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string; actor: string | null;
};

export type Dashboard = {
  counts: { items: number; racks: number; active_reservations: number; low_stock: number };
  low_stock: Array<{ item_id: string; sku: string; name: string; unit: string;
                     available: number; min_stock: number }>;
  recent_movements: StockMovement[];           // 8 terakhir
};

export type Paged<T> = { data: T[]; meta: { next_cursor: string | null } };
export type ApiErrorBody = { error: { code: ErrorCode; message: string; details?: Record<string, unknown> } };
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR'
  | 'VERSION_CONFLICT' | 'LOCKED' | 'RACK_NOT_EMPTY' | 'DUPLICATE_CODE'
  | 'ITEM_INACTIVE' | 'RACK_INACTIVE' | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_KEY_REUSED' | 'RATE_LIMITED' | 'SERVER_ERROR';

// Body permintaan tulis (bagian 4.2).
export type LoginBody = { email: string; password: string };
export type RackCreateBody = { code: string; name: string; location?: string | null; capacity?: number | null };
export type RackUpdateBody = {
  name?: string; location?: string | null; capacity?: number | null; status?: RackStatus;
  expected_version: number;
};
export type AdjustmentMode = 'add' | 'correct';
export type AdjustmentBody = {
  item_id: string; rack_id: string; mode: AdjustmentMode; quantity: number; reason: string;
};
export type AdjustmentResult = { movement: StockMovement; line: StockLine };
