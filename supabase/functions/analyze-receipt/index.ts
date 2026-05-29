// === EDGE FUNCTION — analyze-receipt (Sprint 2) ===
// Trigger    : POST depuis js/ingestion.js via sb.functions.invoke('analyze-receipt')
// Étapes     : parse body → build vision blocks → call Anthropic → parse JSON → return
// Contraintes: multi-pages dans 1 appel · hint optionnel prioritaire · max_tokens 2500
// Cas limites: JSON malformé → fallback confiance 0 / 429 → quota_exceeded

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Décision Pierre 2026-05-26 : alias non-daté (dernière version stable Sonnet 4.6 auto).
const MODEL = 'claude-sonnet-4-6';

// Prompt v5 — Pierre 2026-05-29 (post tests fixtures Sprint 2) :
// reference_fournisseur conditionnelle + description forcée FR + hint Anthropic=MIX.
const PROMPT = `Tu es un OCR comptable pour Galactus, outil interne TDM studio/vu.media.
Analyse la/les images ou PDF d'une pièce comptable et extrais en JSON strict :

CATÉGORIES (categorie_suggeree, exactement 1) :
- "fournisseur" : facture émise par un fournisseur (SaaS, services pros, abonnements)
- "ndf" : ticket/justificatif de note de frais (repas, transport, péage, carburant)
- "materiel" : achat matériel durable (cartes SD, disques, accessoires tournage)
- "vente" : facture émise PAR TDM/vu.media vers un client (rare en input OCR)
(la 5ᵉ "ndf-mois" est générée par l'app, pas extractible OCR)

ACTIVITÉS (activite_suggeree, exactement 1) :
- "VUM" : SaaS marketing/réseaux sociaux (Buffer, Hootsuite, Canva, etc.),
  outils dev liés vu.media (Vercel, Supabase facturées vu.media), prospection vu.media
- "TDM" : matériel vidéo, location studio, audio, prod, formations audio, frais tournage
- "MIX" : usage partagé (internet, téléphone, comptable, banque, assurances pro génériques,
  API/outils IA transverses type Anthropic/Claude API utilisés sur plusieurs projets)

RÈGLES :
- fournisseur_slug : kebab-case ASCII, NFD-normalize, lowercase, espaces→tirets
- date_piece : ISO YYYY-MM-DD
- montants : nombres, point décimal, 2 décimales
- taux_tva : nombre (20, 10, 5.5, 0)
- confiance_ocr : moyenne pondérée 0-1 des confidence_per_field
- confidence_per_field : objet {fournisseur, date, montant, categorie, activite} en 0-1
- reference_fournisseur : numéro de facture/commande imprimé sur le document, conservé
  VERBATIM (aucune normalisation, juste trim des espaces). Le remplir UNIQUEMENT si TOUTES
  ces conditions sont réunies : (1) la pièce est une facture formelle (PAS un ticket de
  caisse, PAS une NDF perso) ; (2) un numéro lisible et explicite est présent, préfixé
  "Facture n°"/"Invoice #"/"N°"/"Ref." ; (3) montant TTC ≥ 100€ OU fournisseur récurrent
  de type abonnement/SaaS (Anthropic, Supabase, Vercel, abonnements mensuels) ;
  (4) confidence ≥ 0.7. Sinon null — ne JAMAIS deviner : un numéro de TVA intracommunautaire
  ou un code-barres n'est PAS une référence de facture.
- description : courte phrase EN FRANÇAIS (toujours, même si la facture est en anglais)
  résumant l'objet de la pièce (ex. "Abonnement API Claude — mai 2026", "Repas équipe
  tournage", "Carte SD tournage"). Max ~80 caractères. Sinon null.

HINT UTILISATEUR : si présent, override les suggestions catégorie/activité.

OUTPUT : JSON brut UNIQUEMENT, pas de markdown, pas de texte autour.

Format de sortie attendu :
{
  "fournisseur": "...",
  "fournisseur_slug": "...",
  "date_piece": "YYYY-MM-DD",
  "reference_fournisseur": "..." ou null,
  "montant_ht": ... ou null,
  "montant_tva": ... ou null,
  "montant_ttc": ...,
  "taux_tva": 20|10|5.5|0|null,
  "categorie_suggeree": "fournisseur"|"ndf"|"materiel"|"vente",
  "activite_suggeree": "TDM"|"VUM"|"MIX",
  "description": "..." ou null,
  "confiance_ocr": 0.xx,
  "confidence_per_field": {"fournisseur":0.xx,"date":0.xx,"montant":0.xx,"categorie":0.xx,"activite":0.xx},
  "ocr_text_brut": "..."
}`;

interface Page {
  numero: number;
  base64: string;
  media_type: string;
}

interface Hint {
  categorie?: string | null;
  activite?: string | null;
}

interface RequestBody {
  pages: Page[];
  hint?: Hint | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json() as RequestBody;
    const { pages, hint } = body;

    // === VALIDATION INPUT ===
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response(JSON.stringify({ error: 'pages array requis (non vide)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('[ANALYZE-RECEIPT] ANTHROPIC_API_KEY non configurée');
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // === BUILD VISION BLOCKS MULTI-PAGES ===
    const userBlocks = pages.map((p) => {
      return p.media_type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: p.media_type, data: p.base64 } };
    });

    // === HINT UTILISATEUR (optionnel) ===
    const hintLine = hint && (hint.categorie || hint.activite)
      ? `\n\nHINT UTILISATEUR (prioritaire — override les suggestions) : categorie=${hint.categorie ?? 'libre'}, activite=${hint.activite ?? 'libre'}`
      : '';

    // === CALL ANTHROPIC ===
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        messages: [{
          role: 'user',
          content: [...userBlocks, { type: 'text', text: PROMPT + hintLine }],
        }],
      }),
    });

    // === GESTION 429 (quota) ===
    if (resp.status === 429) {
      console.warn('[ANALYZE-RECEIPT] Quota Anthropic dépassé');
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 429,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[ANALYZE-RECEIPT] Anthropic erreur', { status: resp.status });
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}`, detail: err }), {
        status: resp.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';

    // === PARSE JSON ===
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return new Response(JSON.stringify(parsed), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch {
      // Fallback : JSON malformé → confiance 0, ocr_text_brut = raw, Pierre remplit à la main
      console.warn('[ANALYZE-RECEIPT] Fallback JSON malformé');
      return new Response(JSON.stringify({
        fournisseur: null,
        fournisseur_slug: null,
        date_piece: null,
        reference_fournisseur: null,
        montant_ht: null,
        montant_tva: null,
        montant_ttc: null,
        taux_tva: null,
        categorie_suggeree: null,
        activite_suggeree: null,
        description: null,
        confiance_ocr: 0,
        confidence_per_field: { fournisseur: 0, date: 0, montant: 0, categorie: 0, activite: 0 },
        ocr_text_brut: text,
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ANALYZE-RECEIPT] Erreur interne', { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
