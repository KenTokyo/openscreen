// =============================================================================
// Gemini Provider - Implementierung des AIProvider-Interfaces fuer Google Gemini
// Wrapper um den bestehenden geminiTranscriptionAdapter
// =============================================================================

import type { AIProvider, AIProviderAnalysisResult } from './aiProvider'
import type { AIAnalysisConfig } from '../../../src/components/video-editor/ai/types'
import { analyzeVideoWithGemini } from './geminiTranscriptionAdapter'

export class GeminiProvider implements AIProvider {
  readonly type = 'gemini'

  async analyze(
    videoPath: string,
    apiKey: string,
    config: AIAnalysisConfig,
    signal?: AbortSignal
  ): Promise<AIProviderAnalysisResult> {
    return analyzeVideoWithGemini(videoPath, apiKey, config, signal)
  }
}
