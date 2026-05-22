import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  'Conception & Préparation',
  'Tournage — Personnel',
  'Déplacements & Transport',
  'Logement',
  'Repas',
  'Matériel & Location décor',
  'Post-Production',
  'Assets Marketing',
  'Autre',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { file_base64, media_type } = await req.json();

    if (!file_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'file_base64 and media_type requis' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const isPdf = media_type === 'application/pdf';
    const block = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
      : { type: 'image', source: { type: 'base64', media_type, data: file_base64 } };

    const prompt = `Analyse ce justificatif de frais professionnel. Réponds UNIQUEMENT avec ce JSON sans texte autour :\n{"montant_ttc":<nombre ou null>,"date":"<YYYY-MM-DD ou null>","description":"<fournisseur + objet, max 80 chars, ou null>","categorie":"<parmi : ${CATEGORIES.join(' | ')} — ou null>","taux_tva":<20|10|5.5|0|null>}\nRègles: montant_ttc = total TTC euros. date = date transaction. description = nom fournisseur + nature dépense. categorie = valeur exacte de la liste. taux_tva = taux de TVA identifié sur le document (20 pour TVA 20%, 10 pour TVA 10%, 5.5 pour TVA 5,5%, 0 si exonéré ou non assujetti, null si introuvable) — chercher lignes TVA, T.V.A., pourcentages dans les tableaux de facturation.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}`, detail: err }), {
        status: resp.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return new Response(JSON.stringify(parsed), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({}), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
