import axios from 'axios';

interface DiagnosticCode {
  code: string;
  name: string;
}

type DiagnosticCodesResponse = [
  number, // total
  string[], // codes
  null, // extra
  [string, string][], // display
  string[] // codeSystem
];

export const searchDiagnosticCodes = async (searchTerm: string): Promise<DiagnosticCode[]> => {
  try {
    const response = await axios.get<DiagnosticCodesResponse>(
      `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search`,
      {
        params: {
          terms: searchTerm,
          sf: 'code,name',
          df: 'code,name'
        }
      }
    );

    // Transform the response into a more usable format
    return response.data[3].map(([code, name]: [string, string]) => ({
      code,
      name
    }));
  } catch (error) {
    console.error('Error fetching diagnostic codes:', error);
    return [];
  }
};

export const getDiagnosticCodeByCode = async (code: string): Promise<DiagnosticCode | null> => {
  try {
    const response = await axios.get<DiagnosticCodesResponse>(
      `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search`,
      {
        params: {
          terms: code,
          sf: 'code',
          df: 'code,name'
        }
      }
    );

    if (response.data[3].length > 0) {
      const [code, name]: [string, string] = response.data[3][0];
      return { code, name };
    }
    return null;
  } catch (error) {
    console.error('Error fetching diagnostic code:', error);
    return null;
  }
};

export const fetchAllCategorizedDiagnosticCodes = async (): Promise<{ [category: string]: DiagnosticCode[] }> => {
  const prefixes = Array.from(Array(26)).map((_, i) => String.fromCharCode(65 + i)); // A-Z
  const categorizedCodes: { [category: string]: DiagnosticCode[] } = {};
  let totalFetchedCount = 0;
  const MAX_TOTAL_CODES = 7500; // NLM API limit for paginated results
  const PAGE_SIZE = 500; // Max results per API call

  for (const prefix of prefixes) {
    if (totalFetchedCount >= MAX_TOTAL_CODES) {
      break; // Stop if we've hit the overall limit
    }

    let currentOffset = 0;
    let keepFetchingForPrefix = true;
    const codesForPrefix: DiagnosticCode[] = [];

    while (keepFetchingForPrefix && totalFetchedCount < MAX_TOTAL_CODES) {
      try {
        const response = await axios.get<DiagnosticCodesResponse>(
          `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search`,
          {
            params: {
              terms: prefix,
              sf: 'code,name', // Search in code and name fields
              df: 'code,name', // Display code and name
              count: PAGE_SIZE,
              offset: currentOffset,
            },
          }
        );

        const newCodes: DiagnosticCode[] = response.data[3]
          .filter(item => item && item[0] && item[0].startsWith(prefix)) // Ensure codes start with the current prefix
          .map(([code, name]: [string, string]) => ({
            code,
            name,
          }));
        
        const numFetchedThisPage = newCodes.length;

        if (numFetchedThisPage > 0) {
          let codesToAdd = newCodes;
          if (totalFetchedCount + numFetchedThisPage > MAX_TOTAL_CODES) {
            const limit = MAX_TOTAL_CODES - totalFetchedCount;
            codesToAdd = newCodes.slice(0, limit);
            totalFetchedCount = MAX_TOTAL_CODES;
          } else {
            totalFetchedCount += numFetchedThisPage;
          }
          codesForPrefix.push(...codesToAdd);
        }

        if (numFetchedThisPage < PAGE_SIZE || response.data[0] <= currentOffset + numFetchedThisPage) {
          // If fewer codes than page size are returned, or total reported codes for term is reached
          keepFetchingForPrefix = false;
        } else {
          currentOffset += PAGE_SIZE;
        }

      } catch (error) {
        console.error(`Error fetching codes for prefix ${prefix} at offset ${currentOffset}:`, error);
        keepFetchingForPrefix = false; // Stop for this prefix on error
      }
    }

    if (codesForPrefix.length > 0) {
      categorizedCodes[prefix] = codesForPrefix;
    }
  }
  console.log(`Fetched a total of ${totalFetchedCount} codes, categorized by prefix.`);
  return categorizedCodes;
}; 