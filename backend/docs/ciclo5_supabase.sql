-- ============================================================
-- CICLO 5 — Esquema Supabase (Postgres)
-- Ejecutar en el SQL Editor de Supabase ANTES de usar los CUs.
-- El backend NO usa el ORM de Django: estas tablas se crean a mano.
-- ============================================================

-- ------------------------------------------------------------
-- CU35 — PayPal: columna para el id de orden de PayPal
-- (usado en Depositar Fondos, junto a Stripe)
-- ------------------------------------------------------------
ALTER TABLE pagos_sistema
    ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- ------------------------------------------------------------
-- CU36 — Órdenes de compra
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orden_compra (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha         DATE          NOT NULL DEFAULT CURRENT_DATE,
    proveedor_id  BIGINT        NOT NULL REFERENCES proveedor(id),
    estado        TEXT          NOT NULL DEFAULT 'generada', -- generada|enviada|recibida|cancelada
    total         NUMERIC(12,2) NOT NULL DEFAULT 0,
    generada_auto BOOLEAN       NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_orden_compra (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id        BIGINT NOT NULL REFERENCES orden_compra(id) ON DELETE CASCADE,
    insumo_id       BIGINT NOT NULL REFERENCES insumo(id),
    cantidad        INTEGER NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- NOTAS:
-- * Si alguna FK (plato/proveedor/insumo) tiene otro tipo de id en tu
--   instancia (p. ej. INTEGER en vez de BIGINT), ajustá el tipo de la
--   columna que referencia para que coincida.
-- * Alternativa a "BIGINT GENERATED ALWAYS AS IDENTITY": usar BIGSERIAL.
-- ------------------------------------------------------------
