export interface Cliente {
  piva: string
  ragione_sociale: string
  indirizzo: string | null
  cap: string | null
  comune: string | null
  provincia: string | null
  sigla_provincia: string | null
  regione: string | null
  email: string | null
  telefono: string | null
  created_at: string
  updated_at: string
}

export interface Documento {
  id: string
  numero_documento: string
  tipo: 'BC' | 'FTA' | 'PC' | 'OC' | 'OF' | 'BF'
  data_documento: string
  piva_cliente: string | null
  piva_fornitore: string | null
  piva_cliente_finale: string | null
  totale: number | null
  percorso_pdf_locale: string | null
  created_at: string
}

export interface Espositore {
  id: string
  matricola: string
  codice_modello: string
  cliente_piva: string | null
  created_at: string
  modelli_espositore?: { nome: string }
}

export interface RigaDocumento {
  id: string
  documento_id: string
  codice_articolo: string | null
  descrizione: string | null
  quantita: number | null
  prezzo_unitario: number | null
  totale_riga: number | null
  note: string | null
  tipo_riga: 'espositore' | 'ricambio' | 'servizio' | 'altro'
  espositore_id: string | null
}

export const TIPO_LABEL: Record<string, string> = {
  BC:  'Bolla',
  FTA: 'Fattura',
  PC:  'Preventivo',
  OC:  'Ordine Cliente',
  OF:  'Ordine Fornitore',
  BF:  'Bolla Reso',
}
