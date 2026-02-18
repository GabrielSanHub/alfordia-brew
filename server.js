import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import template from './client/template.js';

const require = createRequire(import.meta.url);
const less = require('less');

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;

// ============================================================
// 1. CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS
// ============================================================
// Garante que todas as rotas de assets e fontes funcionem
const assetsFolder = path.join(__dirname, 'themes/assets');
const fontsFolder  = path.join(__dirname, 'themes/fonts');

app.use('/assets', express.static(assetsFolder));
app.use('/themes/assets', express.static(assetsFolder));
app.use('/themes/fonts', express.static(fontsFolder));
app.use('/themes/V3/fonts', express.static(fontsFolder));
app.use('/themes/V3/Blank/fonts', express.static(fontsFolder));
app.use('/fonts', express.static(fontsFolder));

app.use(express.static(path.join(__dirname, 'build')));
app.use('/themes', express.static(path.join(__dirname, 'build/themes')));

// ============================================================
// 2. ROTA DE PREVIEW (COM OBJETO DE TEMA COMPLETO)
// ============================================================
app.get(/.*/, async (req, res) => {
    try {
        const pathTxt = path.join(__dirname, 'Manual.txt');
        const pathCss = path.join(__dirname, 'Manual.css');

        if (!fs.existsSync(pathTxt)) {
            return res.status(404).send('<h1>Erro: Manual.txt não encontrado.</h1>');
        }

        const manualText = fs.readFileSync(pathTxt, 'utf8');
        const manualStyle = fs.existsSync(pathCss) ? fs.readFileSync(pathCss, 'utf8') : '';

        // --- A CORREÇÃO MÁGICA ESTÁ AQUI ---
        // Em vez de só dizer o nome do tema, criamos o objeto que o React espera.
        // Isso evita o erro "Cannot read properties of null (reading 'styles')"
        const brewObject = {
            title: 'Preview Local',
            text: manualText,
            style: manualStyle,
            renderer: 'V3',
            theme: '5ePHB',
            // Objeto simulado do banco de dados para o Tema V3
            _theme: {
                title: '5ePHB',
                renderer: 'V3',
                path: 'themes/V3/5ePHB/style.less', // Caminho fictício, mas necessário
                style: '' // O estilo real é carregado pelo <link> abaixo
            },
            authors: [],
            systems: []
        };

        const props = {
            brew: brewObject,
            url: req.originalUrl,
            config: {
                development: true,
                local: true,
                deployment: false,
                isUser: true
            }
        };

        let html = await template('homebrew', props.brew.title, props);

        // Injeção dos estilos na ordem correta
        const styles = `
            <link href="/themes/V3/Blank/style.css" rel="stylesheet" type="text/css" />
            <link href="/themes/V3/5ePHB/style.css" rel="stylesheet" type="text/css" />
            <style>
                /* Ajustes de Preview */
                .homebrew { margin-top: 0 !important; height: 100vh; }
                body { background-color: #333; }
            </style>
        `;
        
        html = html.replace('</head>', `${styles}</head>`);
        res.send(html);

    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno: " + err.message);
    }
});

// ============================================================
// 3. INICIALIZAÇÃO (Compila Temas Base)
// ============================================================
async function buildBaseThemes() {
    const saveCss = async (src, dest) => {
        try {
            const inputPath = path.join(__dirname, src);
            if (!fs.existsSync(inputPath)) return;
            const lessContent = fs.readFileSync(inputPath, 'utf8');
            const output = await less.render(lessContent, {
                filename: inputPath,
                paths: [path.join(__dirname, 'shared'), path.join(__dirname, 'node_modules')]
            });
            fs.mkdirSync(path.dirname(path.join(__dirname, dest)), { recursive: true });
            fs.writeFileSync(path.join(__dirname, dest), output.css);
            console.log(`\t✔ Tema Base Compilado: ${dest}`);
        } catch (e) { console.error(`Erro compilando ${src}:`, e.message); }
    };
    
    console.log("--- Compilando Temas Base ---");
    await saveCss('themes/V3/Blank/style.less', 'build/themes/V3/Blank/style.css');
    await saveCss('themes/V3/5ePHB/style.less', 'build/themes/V3/5ePHB/style.css');
}

(async () => {
    await buildBaseThemes();
    app.listen(PORT, () => {
        console.log(`\n\t✅ PREVIEW ON: http://localhost:${PORT}`);
        console.log(`\t(Erro corrigido: Objeto de tema injetado)\n`);
    });
})();