import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function renderTemplate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    return acc.replace(regex, String(value ?? ''));
  }, template || '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fallbackSender = Deno.env.get('RESEND_FROM_EMAIL') || 'no-reply@komet.local';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY secret');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();

    const to = String(body?.to || '').trim();
    const templateKey = String(body?.templateKey || 'student_completed').trim();
    const respondent = body?.respondent || {};

    if (!to) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: settingsRow, error: settingsError } = await supabase
      .from('system_settings')
      .select('config_value')
      .eq('config_key', 'komet_system')
      .maybeSingle();

    if (settingsError) throw settingsError;

    const config = settingsRow?.config_value || {};
    const templates = config?.email_templates || {};

    const subjectKey = `${templateKey}_subject`;
    const bodyKey = `${templateKey}_body`;

    const subjectTemplate = templates?.[subjectKey] || 'Confirmación de recepción | {{survey_title}}';
    const htmlTemplate = templates?.[bodyKey] || '<p>Hola {{name}},</p><p>Hemos recibido tu encuesta.</p>';

    const vars = {
      name: respondent?.name || 'Participante',
      evaluation_link: respondent?.evaluation_link || '',
      survey_title: respondent?.survey_title || 'Encuesta',
      public_role: respondent?.public_role || '',
      program_level: respondent?.program_level || '',
      program: respondent?.program || '',
      practice_center_name: respondent?.practice_center_name || '',
      period: respondent?.period || '',
      id_type: respondent?.id_type || '',
      id_value: respondent?.id_value || ''
    };

    const subject = renderTemplate(subjectTemplate, vars);
    const html = renderTemplate(htmlTemplate, vars);

    const senderEmail = config?.resend_sender_email || fallbackSender;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [to],
        subject,
        html
      })
    });

    const resendPayload = await resendResponse.json();

    const logPayload = {
      status: resendResponse.ok ? 'sent' : 'error',
      provider: 'resend',
      template_key: templateKey,
      recipient_email: to,
      subject,
      response_id: resendPayload?.id || null,
      error_message: resendResponse.ok ? null : JSON.stringify(resendPayload),
      payload: {
        respondent,
        resendPayload,
        source: body?.source || null
      },
      evaluation_id: body?.evaluationId || null,
      survey_id: body?.surveyId || null
    };

    await supabase.from('email_delivery_log').insert([logPayload]);

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ error: 'Resend send failed', details: resendPayload }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, id: resendPayload?.id || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
