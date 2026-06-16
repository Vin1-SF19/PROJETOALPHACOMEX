/**
 * Ollama Manager for handling URL changes and model detection
 */

/**
 * Fetch available models from an Ollama instance
 * @param ollamaUrl The Ollama API URL to query
 * @returns Promise resolving to an array of available model IDs
 */
export async function fetchAvailableModels(ollamaUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models?.map((model: any) => model.name) || [];
  } catch (error) {
    console.error("[BIBBLE] Failed to fetch available models:", error);
    return [];
  }
}

/**
 * Validate and update Ollama URL
 * @param newUrl The new Ollama URL to set
 * @returns Promise resolving to an object with success status and details
 */
export async function updateOllamaUrl(newUrl: string): Promise<{ success: boolean; error?: string; availableModels?: string[] }> {
  try {
    // Validate URL format
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Invalid URL format. Must start with http:// or https://'
      };
    }

    // Check if the URL is reachable and verify it points to Ollama
    const response = await fetch(`${newUrl}/api/tags`);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to connect to Ollama at ${newUrl}. HTTP ${response.status}`
      };
    }

    // Try to get available models
    const availableModels = await fetchAvailableModels(newUrl);

    return {
      success: true,
      availableModels: availableModels
    };
  } catch (error) {
    console.error("[BIBBLE] Error updating Ollama URL:", error);
    return {
      success: false,
      error: `Failed to update Ollama URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

