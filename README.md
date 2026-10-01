# Simulador de Investimento — Nover Invest

Simulador educacional de evolução patrimonial e perfil indicativo de risco.

## Estrutura

- `index.html` — marcação das 3 etapas (aportes, perfil, lead) e tela de resultado
- `style.css` — tema visual (fundo escuro em gradiente, destaque em dourado `#FEBC01`)
- `script.js` — lógica de simulação, questionário, cálculo projetado e gráfico de evolução
- `logo-nover.svg` — logotipo da marca

## Configuração (`script.js`, objeto `CFG`)

- `whatsappNumber` — já configurado
- `leadWebhookUrl` — pendente: endpoint do CRM/n8n/HubSpot que receberá os leads do formulário
- `privacyUrl` — pendente: URL oficial da política de privacidade

## Rodando localmente

Como é um site estático, basta abrir `index.html` em um servidor local, por exemplo:

```
npx serve .
```
