#!/usr/bin/env node
/**
 * Recalcula precios de viajes PARTICULARES desde mayo 2025 en adelante.
 *
 * Nuevos valores:
 *   Arranque (tarifaBase):  $2600
 *   Por km (tarifaPorKm):   $130
 *   Comisión chofer:        15% (sin cambios)
 *
 * Fórmula:
 *   kmFormula     = kmPagaIngenioSnapshot ?? kmIngenioFinca
 *   valorUnitario = 2600 + 130 * kmFormula
 *   valorTotal    = valorUnitario * (pesoNetoKg / 1000)
 *   comision      = valorTotal * 0.15
 *
 * Uso:
 *   API_BASE_URL=https://tz-backend-production.up.railway.app \
 *   API_KEY=<tu_api_key> \
 *   node scripts/recalcular-particulares.mjs
 *
 * Para aplicar los cambios (por defecto es dry-run):
 *   ... node scripts/recalcular-particulares.mjs --apply
 *
 * Para filtrar desde otra fecha (default: 2025-05-01):
 *   ... node scripts/recalcular-particulares.mjs --desde=2025-06-01
 */

const API_BASE = process.env.API_BASE_URL;
const API_KEY  = process.env.API_KEY;
const APPLY    = process.argv.includes("--apply");

const desdeArg = process.argv.find(a => a.startsWith("--desde="));
const DESDE    = desdeArg ? desdeArg.split("=")[1] : "2025-05-01";

// Nuevas tarifas
const TARIFA_BASE      = 2600;
const TARIFA_POR_KM    = 130;
const COMISION_PCT     = 0.15;

// ─── Validaciones ─────────────────────────────────────────────────────────────

if (!API_BASE || !API_KEY) {
  console.error("\n❌ Faltan variables de entorno:");
  console.error("   API_BASE_URL=<url>  API_KEY=<key>  node scripts/recalcular-particulares.mjs\n");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message ?? j.error ?? msg; } catch {}
    throw new Error(`${msg} — ${path}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

function calcular(viaje) {
  const kmFormula = viaje.kmPagaIngenioSnapshot ?? viaje.kmIngenioFinca;
  if (kmFormula == null || kmFormula <= 0) return null;
  if (!viaje.pesoNetoKg || viaje.pesoNetoKg <= 0) return null;

  const valorUnitario  = TARIFA_BASE + TARIFA_POR_KM * kmFormula;
  const valorTotal     = valorUnitario * (viaje.pesoNetoKg / 1000);
  const comisionChofer = valorTotal * COMISION_PCT;

  return { valorUnitario, valorTotal, comisionChofer };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Recalcular Particulares Zafra");
  console.log(`  Desde: ${DESDE}`);
  console.log(`  Arranque: ${fmt(TARIFA_BASE)}  |  Km: ${fmt(TARIFA_POR_KM)}  |  Comisión: ${(COMISION_PCT * 100).toFixed(0)}%`);
  console.log(`  Modo: ${APPLY ? "⚡ APLICAR CAMBIOS" : "🔍 DRY-RUN (solo lectura)"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Obtener todos los viajes desde la fecha indicada
  const qs = new URLSearchParams({ from: DESDE, limit: "2000" });
  let viajes;

  try {
    const resp = await apiFetch(`/registro-viajes?${qs.toString()}`);
    viajes = resp.viajes ?? [];
  } catch (err) {
    console.error("❌ No se pudo obtener la lista de viajes:", err.message);
    console.error("   Verificá que el endpoint acepte la petición sin choferId (acceso admin).");
    process.exit(1);
  }

  console.log(`📦 Viajes obtenidos del servidor: ${viajes.length}`);

  // Filtrar solo PARTICULARES
  const particulares = viajes.filter(v => v.modalidad === "PARTICULARES");
  console.log(`🎯 Viajes PARTICULARES en el período: ${particulares.length}\n`);

  if (particulares.length === 0) {
    console.log("✅ Nada que actualizar.\n");
    return;
  }

  let actualizados = 0;
  let omitidos    = 0;
  let errores     = 0;

  for (const viaje of particulares) {
    const nuevos = calcular(viaje);

    if (!nuevos) {
      console.log(`⚠️  Omitido ${viaje.id.slice(0, 8)}… (${viaje.fecha}) — sin kg o km válido`);
      omitidos++;
      continue;
    }

    const anteriorUnit  = viaje.valorUnitarioARS ?? 0;
    const anteriorTotal = viaje.valorTotalARS    ?? 0;
    const anteriorCom   = viaje.comisionChofer   ?? 0;
    const kmUsado       = viaje.kmPagaIngenioSnapshot ?? viaje.kmIngenioFinca;

    console.log(`${APPLY ? "🔄" : "🔍"} Viaje ${viaje.id.slice(0, 8)}… | ${viaje.fecha} | ${viaje.choferNombre}`);
    console.log(`     km: ${kmUsado}  peso: ${viaje.pesoNetoKg?.toLocaleString("es-AR")} kg`);
    console.log(`     Unitario: ${fmt(anteriorUnit)}  →  ${fmt(nuevos.valorUnitario)}`);
    console.log(`     Total:    ${fmt(anteriorTotal)}  →  ${fmt(nuevos.valorTotal)}`);
    console.log(`     Comisión: ${fmt(anteriorCom)}  →  ${fmt(nuevos.comisionChofer)}`);

    if (APPLY) {
      try {
        await apiFetch(`/registro-viajes/${viaje.id}`, {
          method: "PUT",
          body: JSON.stringify({
            valorUnitarioARS:  nuevos.valorUnitario,
            valorTotalARS:     nuevos.valorTotal,
            comisionChofer:    nuevos.comisionChofer,
            tarifaBaseSnapshot:   TARIFA_BASE,
            tarifaPorKmSnapshot:  TARIFA_POR_KM,
            comisionPctSnapshot:  COMISION_PCT,
          }),
        });
        console.log("     ✅ Actualizado\n");
        actualizados++;
      } catch (err) {
        console.error(`     ❌ Error: ${err.message}\n`);
        errores++;
      }
    } else {
      console.log();
    }
  }

  // Resumen
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RESUMEN");
  if (APPLY) {
    console.log(`  ✅ Actualizados: ${actualizados}`);
    console.log(`  ⚠️  Omitidos:     ${omitidos}  (sin kg o km válido)`);
    if (errores) console.log(`  ❌ Errores:      ${errores}`);
  } else {
    console.log(`  🔍 Se recalcularían: ${particulares.length - omitidos} viajes`);
    console.log(`  ⚠️  Se omitirían:    ${omitidos}  (sin kg o km válido)`);
    console.log();
    console.log("  Ejecutá con --apply para aplicar los cambios:");
    console.log("  API_BASE_URL=... API_KEY=... node scripts/recalcular-particulares.mjs --apply");
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌ Error fatal:", err.message);
  process.exit(1);
});
