/* ==============================================================
   NOVER INVEST — SIMULADOR EDUCACIONAL

   O que configurar antes de publicar:
   1) CFG.whatsappNumber      -> configurado
   2) CFG.leadWebhookUrl      -> pendente (defina o endpoint do CRM)
   3) CFG.privacyUrl          -> pendente (URL oficial da política de privacidade)
   4) identidade visual       -> definida em style.css (:root)
   5) texto jurídico/compliance final aprovado pela Nover/XP
   ============================================================== */

const CFG = {
  minInitial: 100,
  defaultYears: 5,
  yearsMin: 1,
  yearsMax: 30,
  yearShortcuts: [1,3,5,10,15,20],
  fallbackCDI: 14.90,
  bcbSeries: 4389, // CDI anualizado, base 252
  bcbUrl: s => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s}/dados/ultimos/2?formato=json`,

  whatsappNumber: '5582993827390',

  /* Cole aqui o endpoint do CRM/n8n/HubSpot/Pipedrive etc. Ex.: https://seu-dominio.com/webhook/nover-simulador */
  leadWebhookUrl: '',

  /* Ajuste para a URL oficial */
  privacyUrl: '/politica-de-privacidade'
};

const state = {
  initialCents: 0,
  monthlyCents: 0,
  years: CFG.defaultYears,
  answers: {},
  rate: {
    cdi: CFG.fallbackCDI,
    source: 'Taxa de contingência',
    refDate: null
  },
  utm: {}
};

const $ = id => document.getElementById(id);
const brl = n => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct = n => Number(n || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
const compactBRL = n => {
  const v = Number(n || 0);
  if(v >= 1000000) return 'R$ ' + (v/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mi';
  if(v >= 1000) return 'R$ ' + (v/1000).toLocaleString('pt-BR',{maximumFractionDigits:0}) + ' mil';
  return brl(v);
};

function moneyMask(el, key){
  el.addEventListener('input', e => {
    const cents = parseInt(e.target.value.replace(/\D/g,'') || '0',10);
    state[key] = cents;
    e.target.value = cents ? brl(cents/100) : '';
    validateStep1();
  });
}

moneyMask($('initial'),'initialCents');
moneyMask($('monthly'),'monthlyCents');

function phoneMask(v){
  const d = v.replace(/\D/g,'').slice(0,11);
  if(d.length <= 2) return d;
  if(d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
$('phone').addEventListener('input', e => e.target.value = phoneMask(e.target.value));

function validateStep1(){
  const val = state.initialCents/100;
  const ok = val >= CFG.minInitial;
  $('initialErr').textContent = state.initialCents && !ok
    ? `O valor inicial mínimo para esta simulação é ${brl(CFG.minInitial)}.`
    : '';
  $('next1').disabled = !ok;
}

function setYears(n){
  state.years = Math.max(CFG.yearsMin,Math.min(CFG.yearsMax,Number(n)));
  $('years').value = state.years;
  $('yearsLabel').textContent = state.years + (state.years === 1 ? ' ano' : ' anos');
  document.querySelectorAll('.chip[data-year]').forEach(chip=>{
    chip.classList.toggle('on',Number(chip.dataset.year) === state.years);
  });
}
$('years').addEventListener('input',e=>setYears(e.target.value));

$('yearChips').innerHTML = CFG.yearShortcuts.map(y =>
  `<button type="button" class="chip" data-year="${y}">${y} ${y===1?'ano':'anos'}</button>`
).join('');
document.querySelectorAll('.chip[data-year]').forEach(chip=>{
  chip.addEventListener('click',()=>setYears(chip.dataset.year));
});
setYears(CFG.defaultYears);

async function loadCDI(){
  try{
    const response = await fetch(CFG.bcbUrl(CFG.bcbSeries));
    if(!response.ok) throw new Error('BCB indisponível');
    const data = await response.json();
    const last = data?.[data.length-1];
    const value = parseFloat(String(last?.valor || '').replace(',','.'));
    if(!Number.isFinite(value)) throw new Error('Taxa inválida');

    state.rate = {
      cdi:value,
      source:'Banco Central do Brasil — SGS 4389',
      refDate:last?.data || null
    };

    $('rateInfo').textContent =
      `Taxa de referência atualizada: CDI ${pct(value)} a.a. Fonte: Banco Central do Brasil.`;
  }catch(err){
    state.rate = {
      cdi:CFG.fallbackCDI,
      source:'Taxa de contingência configurada no simulador',
      refDate:null
    };
    $('rateInfo').textContent =
      `Não foi possível atualizar o CDI agora. O simulador usará temporariamente ${pct(CFG.fallbackCDI)} a.a. como taxa de contingência configurada.`;
  }
}
loadCDI();

const QUESTIONS = [
  {
    id:'goal',
    title:'1. O que mais pesa para você ao investir?',
    opts:[
      ['Preservar o patrimônio, mesmo abrindo mão de parte do potencial de retorno.',0],
      ['Equilibrar estabilidade e crescimento ao longo do tempo.',1],
      ['Buscar crescimento maior, aceitando oscilações relevantes no caminho.',2]
    ]
  },
  {
    id:'drop',
    title:'2. Se parte dos seus investimentos caísse cerca de 10% em um período curto, qual seria sua reação mais provável?',
    opts:[
      ['Eu ficaria desconfortável e provavelmente reduziria a exposição ao risco.',0],
      ['Eu revisaria o cenário antes de decidir e poderia manter a posição.',1],
      ['Eu aceitaria a oscilação se a estratégia de longo prazo continuasse fazendo sentido.',2]
    ]
  },
  {
    id:'horizon',
    title:'3. Quando você imagina precisar de uma parcela relevante desse dinheiro?',
    opts:[
      ['Em até 2 anos.',0],
      ['Entre 2 e 5 anos.',1],
      ['Em mais de 5 anos.',2]
    ]
  },
  {
    id:'knowledge',
    title:'4. Como você descreve sua experiência com investimentos?',
    opts:[
      ['Estou começando ou prefiro produtos que entendo com facilidade.',0],
      ['Já invisto em diferentes classes e acompanho minha carteira.',1],
      ['Tenho experiência com oscilações, renda variável e estratégias mais complexas.',2]
    ]
  },
  {
    id:'liquidity',
    title:'5. Qual afirmação mais combina com sua necessidade de liquidez?',
    opts:[
      ['Quero a maior parte do patrimônio disponível para resgate com facilidade.',0],
      ['Posso dividir entre liquidez e objetivos de médio/longo prazo.',1],
      ['Posso manter parte relevante do patrimônio investida por períodos mais longos.',2]
    ]
  }
];

$('questions').innerHTML = QUESTIONS.map((q,qi) => `
  <div class="question${qi===0 ? ' visible' : ' hidden'}" data-q="${q.id}">
    <div class="q-title">${q.title}</div>
    <div class="options">
      ${q.opts.map(([label,score],i)=>`
        <button type="button" class="option" data-q="${q.id}" data-score="${score}" data-index="${i}">
          ${label}
        </button>
      `).join('')}
    </div>
  </div>
`).join('');

function revealNextQuestion(currentId){
  const qIndex = QUESTIONS.findIndex(q=>q.id === currentId);
  const next = QUESTIONS[qIndex+1];
  if(!next) return;

  const nextEl = document.querySelector(`.question[data-q="${next.id}"]`);
  if(!nextEl || nextEl.classList.contains('visible')) return;

  nextEl.classList.remove('hidden');
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=> nextEl.classList.add('visible'));
  });
  nextEl.scrollIntoView({behavior:'smooth',block:'center'});
}

document.querySelectorAll('.option').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const q = btn.dataset.q;
    state.answers[q] = Number(btn.dataset.score);

    document.querySelectorAll(`.option[data-q="${q}"]`).forEach(x=>x.classList.remove('on'));
    btn.classList.add('on');

    $('next2').disabled = Object.keys(state.answers).length !== QUESTIONS.length;

    revealNextQuestion(q);
  });
});

function getProfile(){
  const score = Object.values(state.answers).reduce((a,b)=>a+b,0);

  if(score <= 3){
    return {
      key:'conservador',
      label:'Conservador',
      score,
      desc:'Suas respostas indicam maior prioridade para preservação, previsibilidade e liquidez, com menor conforto diante de oscilações.',
      principles:[
        'Liquidez e reserva para imprevistos tendem a ter peso importante na organização financeira.',
        'Prazo e risco precisam estar muito claros antes de assumir oscilações adicionais.',
        'Diversificação continua relevante, mas sempre respeitando sua tolerância a perdas.'
      ]
    };
  }

  if(score <= 7){
    return {
      key:'moderado',
      label:'Moderado',
      score,
      desc:'Suas respostas sugerem busca por equilíbrio entre estabilidade e crescimento, com alguma tolerância a oscilações quando existe horizonte adequado.',
      principles:[
        'Objetivos de curto, médio e longo prazo podem exigir estruturas diferentes.',
        'Diversificação pode ajudar a equilibrar liquidez, risco e potencial de crescimento.',
        'Oscilações fazem parte de algumas classes e precisam estar compatíveis com seu prazo.'
      ]
    };
  }

  return {
    key:'arrojado',
    label:'Arrojado',
    score,
    desc:'Suas respostas indicam maior tolerância a oscilações e horizonte mais longo, com disposição para aceitar risco em busca de crescimento.',
    principles:[
      'Maior tolerância a risco não elimina a necessidade de reserva, liquidez e diversificação.',
      'Oscilações relevantes podem ocorrer e precisam caber no seu horizonte e capacidade financeira.',
      'A alocação adequada depende do conjunto do patrimônio, objetivos e experiência do investidor.'
    ]
  };
}

function go(step){
  ['s1','s2','s3'].forEach((id,i)=>$(id).classList.toggle('hidden',i+1 !== step));
  $('result').classList.add('hidden');
  $('stepper').classList.remove('hidden');
  $('intro').classList.remove('hidden');

  const dots = [...document.querySelectorAll('.dot')];
  const conns = [...document.querySelectorAll('.connector')];
  dots.forEach((d,i)=>d.classList.toggle('on',i < step));
  conns.forEach((c,i)=>c.classList.toggle('on',i < step-1));

  window.scrollTo({top:0,behavior:'smooth'});
}

$('next1').addEventListener('click',()=>go(2));
$('next2').addEventListener('click',()=>go(3));
document.querySelectorAll('[data-back]').forEach(btn=>{
  btn.addEventListener('click',()=>go(Number(btn.dataset.back)));
});

function captureUtm(){
  const p = new URLSearchParams(location.search);
  const fields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
  state.utm = {};
  fields.forEach(k=>{
    const v = p.get(k);
    if(v) state.utm[k] = v;
  });
}
captureUtm();

$('privacyLink').href = CFG.privacyUrl;

function validateLead(){
  const name = $('name').value.trim();
  const email = $('email').value.trim();
  const phoneDigits = $('phone').value.replace(/\D/g,'');
  const objective = $('objective').value;
  const privacy = $('privacy').checked;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if(!name || phoneDigits.length < 10 || !emailOk || !objective || !privacy){
    $('formErr').textContent =
      'Preencha nome, WhatsApp, e-mail, objetivo e confirme a ciência do Aviso de Privacidade.';
    return false;
  }

  $('formErr').textContent = '';
  return true;
}

function buildSeries(){
  const initial = state.initialCents/100;
  const monthly = state.monthlyCents/100;
  const annual = state.rate.cdi/100;
  const rm = Math.pow(1+annual,1/12)-1;

  const points = [];
  for(let y=0;y<=state.years;y++){
    const months = y*12;
    const futureInitial = initial*Math.pow(1+rm,months);
    const futureMonthly = rm === 0
      ? monthly*months
      : monthly*((Math.pow(1+rm,months)-1)/rm);

    points.push({
      year:y,
      future: futureInitial+futureMonthly,
      contributed: initial+monthly*months
    });
  }
  return points;
}

function calculateProjection(){
  const series = buildSeries();
  const last = series[series.length-1];

  return {
    initial: state.initialCents/100,
    monthly: state.monthlyCents/100,
    months: state.years*12,
    future: last.future,
    contributed: last.contributed,
    grossGain: last.future-last.contributed
  };
}

function renderChart(points){
  const W = 640, H = 260;
  const padL = 8, padR = 10, padT = 16, padB = 28;
  const plotW = W-padL-padR;
  const plotH = H-padT-padB;
  const maxYear = points[points.length-1].year || 1;
  const maxVal = Math.max(...points.map(p=>Math.max(p.future,p.contributed)),1);

  const x = year => padL + (year/maxYear)*plotW;
  const y = value => padT + plotH - (value/maxVal)*plotH;

  const futurePath = points.map((p,i)=>`${i===0?'M':'L'}${x(p.year).toFixed(1)},${y(p.future).toFixed(1)}`).join(' ');
  const contribPath = points.map((p,i)=>`${i===0?'M':'L'}${x(p.year).toFixed(1)},${y(p.contributed).toFixed(1)}`).join(' ');
  const baseline = (padT+plotH).toFixed(1);
  const areaPath = `${futurePath} L${x(points[points.length-1].year).toFixed(1)},${baseline} L${x(points[0].year).toFixed(1)},${baseline} Z`;

  const gridCount = 4;
  const gridLines = Array.from({length:gridCount+1}).map((_,i)=>{
    const val = maxVal*i/gridCount;
    const gy = y(val).toFixed(1);
    return `<line x1="${padL}" y1="${gy}" x2="${W-padR}" y2="${gy}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
      <text x="${padL}" y="${(Number(gy)-6).toFixed(1)}" fill="rgba(255,255,255,.45)" font-size="10" font-family="Inter, sans-serif">${compactBRL(val)}</text>`;
  }).join('');

  const tickCount = Math.min(points.length,6);
  const tickIdxs = [...new Set(Array.from({length:tickCount}).map((_,i)=>
    Math.round(i*(points.length-1)/(tickCount-1||1))
  ))];
  const xLabels = tickIdxs.map(i=>{
    const p = points[i];
    const label = p.year===0 ? 'Hoje' : `${p.year}a`;
    return `<text x="${x(p.year).toFixed(1)}" y="${H-8}" fill="rgba(255,255,255,.45)" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${label}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FEBC01" stop-opacity=".30"/>
          <stop offset="100%" stop-color="#FEBC01" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#areaGradient)" stroke="none"/>
      <path d="${contribPath}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="5,4"/>
      <path d="${futurePath}" fill="none" stroke="#FEBC01" stroke-width="2.5"/>
      ${xLabels}
    </svg>
  `;
}

function buildLeadPayload(){
  const profile = getProfile();
  const calc = calculateProjection();

  return {
    source:'nover_simulador',
    createdAt:new Date().toISOString(),

    contact:{
      name:$('name').value.trim(),
      phone:$('phone').value.trim(),
      email:$('email').value.trim()
    },

    qualification:{
      objective:$('objective').value,
      investedRange:$('investedRange').value || null,
      marketingOptIn:$('marketing').checked
    },

    simulation:{
      initial:calc.initial,
      monthly:calc.monthly,
      years:state.years,
      cdiReference:state.rate.cdi,
      cdiSource:state.rate.source,
      projectedGrossValue:Number(calc.future.toFixed(2)),
      totalContributed:Number(calc.contributed.toFixed(2))
    },

    indicativeProfile:{
      key:profile.key,
      label:profile.label,
      score:profile.score,
      answers:state.answers
    },

    attribution:state.utm,
    page:location.href
  };
}

async function sendLead(payload){
  if(!CFG.leadWebhookUrl){
    console.info('Nover simulador: leadWebhookUrl não configurado.',payload);
    return {ok:false,reason:'webhook_not_configured'};
  }

  try{
    const response = await fetch(CFG.leadWebhookUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });

    return {ok:response.ok,status:response.status};
  }catch(error){
    console.warn('Falha ao enviar lead:',error);
    return {ok:false,reason:'network_error'};
  }
}

function renderResult(){
  const calc = calculateProjection();
  const profile = getProfile();
  const series = buildSeries();

  $('futureValue').textContent = brl(calc.future);
  $('totalContributed').textContent = brl(calc.contributed);

  $('futureCopy').textContent =
    `Estimativa bruta para ${state.years} ${state.years===1?'ano':'anos'}, considerando ${brl(calc.initial)} de aporte inicial` +
    (calc.monthly > 0 ? ` e ${brl(calc.monthly)} por mês` : '') +
    `, usando o CDI atual de ${pct(state.rate.cdi)} a.a. como taxa constante de referência.`;

  $('barContribLabel').textContent = brl(calc.contributed);
  $('barFutureLabel').textContent = brl(calc.future);

  const max = Math.max(calc.future,calc.contributed,1);
  $('barContrib').style.width = `${Math.max(6,calc.contributed/max*100)}%`;
  $('barFuture').style.width = `${Math.max(6,calc.future/max*100)}%`;

  $('resultRateInfo').textContent =
    `Referência: CDI ${pct(state.rate.cdi)} a.a. · ${state.rate.source}` +
    (state.rate.refDate ? ` · dado de ${state.rate.refDate}` : '') +
    `. O cálculo mantém essa taxa constante apenas para fins ilustrativos.`;

  $('evolutionChart').innerHTML = renderChart(series);
  $('evolutionChart').setAttribute('aria-label',
    `Gráfico de evolução do patrimônio: de ${brl(series[0].future)} hoje até ${brl(calc.future)} projetados em ${state.years} ${state.years===1?'ano':'anos'}, frente a ${brl(calc.contributed)} de total aportado.`
  );

  $('profileName').textContent = profile.label;
  $('profileDesc').textContent = profile.desc;
  $('principles').innerHTML = profile.principles.map(x=>`<li>${x}</li>`).join('');

  const msg = encodeURIComponent(
    `Olá, vim pelo Simulador da Nover. Meu perfil indicativo foi ${profile.label} e gostaria de conversar com um assessor sobre meus objetivos.`
  );

  if(/^\d{12,15}$/.test(CFG.whatsappNumber)){
    $('whatsappCta').href = `https://wa.me/${CFG.whatsappNumber}?text=${msg}`;
  }else{
    $('whatsappCta').href = '#';
    $('whatsappCta').addEventListener('click',e=>{
      e.preventDefault();
      alert('Configure o número oficial da Nover em CFG.whatsappNumber antes de publicar.');
    },{once:true});
  }

  $('s3').classList.add('hidden');
  $('stepper').classList.add('hidden');
  $('intro').classList.add('hidden');
  $('result').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

$('leadForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!validateLead()) return;

  const submitBtn = e.submitter;
  const oldText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Gerando resultado...';

  const payload = buildLeadPayload();
  await sendLead(payload);

  renderResult();

  submitBtn.disabled = false;
  submitBtn.textContent = oldText;
});

$('restart').addEventListener('click',()=>location.reload());

validateStep1();
