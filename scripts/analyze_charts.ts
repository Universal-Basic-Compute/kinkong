import { exec } from 'child_process';
import { promisify } from 'util';
import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { sendTelegramMessage } from '../backend/src/utils/telegram';
import { createThought } from '../backend/src/airtable/thoughts';

const execAsync = promisify(exec);

interface ChartAnalysis {
  timeframe: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  riskRewardRatio?: number;
}

async function generateCharts(): Promise<string[]> {
  try {
    console.log('Generating charts via Python script...');
    await execAsync('python scripts/generate_chart.py');
    
    // Get list of generated chart files
    const chartsDir = path.join(process.cwd(), 'public', 'charts');
    const files = await fs.readdir(chartsDir);
    return files.filter(f => f.endsWith('.png')).map(f => path.join(chartsDir, f));
  } catch (error) {
    console.error('Failed to generate charts:', error);
    throw error;
  }
}

async function analyzeChartWithClaude(chartPath: string): Promise<ChartAnalysis> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const imageData = await fs.readFile(chartPath, { encoding: 'base64' });
  const filename = path.basename(chartPath);
  
  // Extract timeframe from filename
  const timeframe = filename.includes('15m') ? '15m' : 
                   filename.includes('2h') ? '2h' : '8h';

  const prompt = `You are an expert crypto technical analyst. Analyze this UBC/USD chart and provide:
1. Clear BUY/SELL/HOLD signal with confidence level (0-100%)
2. Key support and resistance levels
3. Detailed reasoning including:
   - Trend analysis
   - Volume analysis
   - Key patterns
   - Risk/reward ratio if applicable
Format your response as JSON matching the ChartAnalysis interface.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageData
            }
          }
        ]
      }]
    });

    // Parse and validate Claude's response
    const analysis = JSON.parse(message.content[0].text) as ChartAnalysis;
    analysis.timeframe = timeframe;
    return analysis;
  } catch (error) {
    console.error(`Failed to analyze chart ${filename}:`, error);
    throw error;
  }
}

async function generateSignal(analyses: ChartAnalysis[]) {
  // Combine analyses from different timeframes
  const signal = {
    shortTerm: analyses.find(a => a.timeframe === '15m'),
    mediumTerm: analyses.find(a => a.timeframe === '2h'),
    longTerm: analyses.find(a => a.timeframe === '8h')
  };

  // Create detailed message
  const message = `🔄 UBC Technical Analysis Update

Short-term (15m):
Signal: ${signal.shortTerm?.signal} (${signal.shortTerm?.confidence}% confidence)
${signal.shortTerm?.reasoning}

Medium-term (2h):
Signal: ${signal.mediumTerm?.signal} (${signal.mediumTerm?.confidence}% confidence)
${signal.mediumTerm?.reasoning}

Long-term (8h):
Signal: ${signal.longTerm?.signal} (${signal.longTerm?.confidence}% confidence)
${signal.longTerm?.reasoning}

Key Levels:
Support: ${signal.mediumTerm?.keyLevels.support.join(', ')}
Resistance: ${signal.mediumTerm?.keyLevels.resistance.join(', ')}
`;

  // Send to Telegram
  await sendTelegramMessage(message);

  // Create thought in Airtable
  await createThought({
    type: 'TECHNICAL_ANALYSIS',
    content: message,
    context: {
      analyses,
      timestamp: new Date().toISOString()
    }
  });
}

async function main() {
  try {
    // 1. Generate charts
    const chartPaths = await generateCharts();
    console.log('Charts generated:', chartPaths);

    // 2. Analyze each chart
    const analyses = await Promise.all(
      chartPaths.map(path => analyzeChartWithClaude(path))
    );
    console.log('Analyses completed:', analyses);

    // 3. Generate and send signal
    await generateSignal(analyses);
    console.log('Signal generated and sent');

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
