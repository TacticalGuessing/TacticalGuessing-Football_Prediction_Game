// frontend/src/lib/api.ts
//import { toast } from 'react-hot-toast'; // <<< Ensure this is imported

// Define the base URL for the API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
console.log(`[api.ts] API_BASE_URL configured as: ${API_BASE_URL}`);

// --- Interfaces for API Data Structures ---

// User Authentication
export interface RegisterUserData {
    name: string;
    email: string;
    password?: string;
}

export interface LoginCredentials {
    email: string;
    password?: string;
}

export interface User {
    userId: number;
    name: string;
    email: string;
    role: 'PLAYER' | 'ADMIN';
}

export interface AuthResponse {
    token: string;
    user: User;
}

// Rounds and Fixtures
export interface Round {
    roundId: number;
    name: string;
    deadline: string; // ISO date string
    status: 'SETUP' | 'OPEN' | 'CLOSED' | 'COMPLETED';
}

export interface Fixture {
    fixtureId: number;
    roundId: number;
    homeTeam: string; // Use camelCase consistently in frontend interfaces
    awayTeam: string; // Use camelCase consistently in frontend interfaces
    matchTime: string; // ISO date string
    homeScore: number | null; // Use null for consistency
    awayScore: number | null; // Use null for consistency
    status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELED'; // Add status from backend
}

// === ADD THIS INTERFACE ===
export interface PotentialFixture {
    externalId: number; // The ID from football-data.org
    homeTeam: string;
    awayTeam: string;
    matchTime: string; // ISO String (UTC from football-data.org)
}
// ==========================


// Predictions
export interface Prediction {
    predictionId?: number;
    userId?: number;
    fixtureId: number;
    roundId?: number;
    predictedHomeGoals: number | null;
    predictedAwayGoals: number | null;
    pointsAwarded?: number | null;
    isJoker?: boolean;
    submittedAt?: string; // ISO date string
}

export interface PredictionPayload {
    fixtureId: number;
    predictedHomeGoals: number | null; // Allow null initially
    predictedAwayGoals: number | null; // Allow null initially
    // isJoker?: boolean; // Add later if needed
}

// Combined type used in Dashboard/ActiveRound fetch
export interface FixtureWithPrediction extends Fixture {
    predictedHomeGoals: number | null; // Use null consistently
    predictedAwayGoals: number | null; // Use null consistently
    isJoker?: boolean;
}


// Response type for GET /rounds/active
export interface ActiveRoundResponse {
    roundId: number;
    name: string;
    deadline: string;
    status: 'SETUP' | 'OPEN' | 'CLOSED' | 'COMPLETED'; // Match Round['status']
    fixtures: FixtureWithPrediction[];
}


// Simple types for specific use cases
export interface SimpleRound {
    roundId: number;
    name: string;
}

// ========================================================
// ===== STANDING ENTRY INTERFACE - UPDATED ===============
// ========================================================
export interface StandingEntry {
  rank: number;
  userId: number; // Keep userId for potential key prop or future use
  name: string;
  points: number;
  movement: number | null; // Positive (up), negative (down), or null (no change/first round)
  totalPredictions: number; // 'Pld' column
  correctOutcomes: number; // 'Outcome' column
  exactScores: number; // 'Exact' column
  accuracy: number | null; // Percentage (e.g., 75.5) or null if no predictions
}
// ========================================================
// ========================================================


// --- Admin Specific Interfaces ---

// Payload for creating a round
export interface CreateRoundPayload {
    name: string;
    deadline: string; // Expecting ISO format string (or datetime-local string if backend handles it)
}

// Payload for updating round status
export interface UpdateRoundStatusPayload {
    status: 'SETUP' | 'OPEN' | 'CLOSED'; // Only allow setting these explicitly
}

// --- NEW: Payload for updating round details (name, deadline) ---
export interface UpdateRoundPayload {
    name?: string;     // Optional: Only send if changed
    deadline?: string; // Optional: Only send if changed. Expecting ISO or datetime-local string
}


// Payload for adding a single fixture manually
export interface AddFixturePayload {
    homeTeam: string; // Use camelCase
    awayTeam: string; // Use camelCase
    matchTime: string; // Expecting ISO format string
}

/**
 * Type definition for the payload when submitting fixture results.
 */
export interface ResultPayload {
    homeScore: number; // Use camelCase
    awayScore: number; // Use camelCase
}

// Payload for importing fixtures
export interface ImportFixturesPayload {
    roundId: number;
    competitionCode: string; // e.g., 'PL' for Premier League
    matchday: number | string; // e.g., 1 or '1'
}

// Response type for importing fixtures
export interface ImportFixturesResponse { // Keep this defined if used elsewhere
    message: string;
    count: number;
}


// --- Helper Function ---

/**
 * A wrapper around fetch that automatically adds the Authorization header
 * and handles common error scenarios.
 * NOTE: This helper *returns the Response object* on success, requires manual .json() parsing.
 * It throws an error on non-ok responses.
 */
const fetchWithAuth = async (url: string, options: RequestInit = {}, token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...Object.entries(options.headers || {}).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: headers,
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
          // Attempt to read error message from backend { message: "..." } structure
          const errorData = await response.json();
          errorMessage = errorData?.message || errorMessage;
      } catch {
          // Ignore error if response body is not JSON or empty
      }
      console.error("API Fetch Error:", errorMessage, "URL:", url, "Options:", options);
      // Throw a new Error object so stack trace originates here
      throw new Error(errorMessage);
    }

    return response; // Returns the raw Response object on success
};

// --- Helper Function for Case Mapping ---
// Simple snake_case to camelCase converter for object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCamelCase = <T>(obj: any): T => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj; // Return non-objects or arrays as is
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            newObj[newKey] = toCamelCase(obj[key]); // Recursively map nested objects
        }
    }
    return newObj as T;
};

// Helper to map an array of objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapArrayToCamelCase = <T>(arr: any[]): T[] => {
     if (!Array.isArray(arr)) {
        console.warn("mapArrayToCamelCase received non-array:", arr);
        return []; // Return empty array if input is not an array
     }
     // Ensure each item is recursively mapped
     return arr.map(item => toCamelCase<T>(item));
};


// --- API Functions ---

// == User Facing Functions ==

/**
 * Registers a new user.
 */
export const registerUser = async (userData: RegisterUserData): Promise<void> => {
    // Send camelCase, assume backend handles it or converts internally
    await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    }, null);
    // No return value needed, fetchWithAuth throws on error
};

/**
 * Logs in a user. Backend should return camelCase AuthResponse.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    // Send camelCase, backend login likely expects this
    const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }, null);
    // Backend auth returns camelCase directly as per previous setup
    const data = await response.json();
    // Ensure the returned object matches AuthResponse, casting might hide issues
    // Consider adding runtime validation if necessary
    return data as AuthResponse;
};

/**
 * Fetches the currently active round ('OPEN' status), its fixtures, and the logged-in user's predictions.
 * Backend /rounds/active already provides mapped camelCase response.
 */
export const getActiveRound = async (token: string): Promise<ActiveRoundResponse | null> => {
    try {
        const response = await fetchWithAuth('/rounds/active', { method: 'GET' }, token);
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null;
        }
        const data = await response.json();
        if (!data) return null;

        // Backend already maps to camelCase for this specific route
        // Type assertion is safe if backend contract is maintained
        return data as ActiveRoundResponse;
    } catch (error) {
         if (error instanceof Error && error.message.includes('404')) {
             console.log("No active round found (404).");
             return null;
         }
         console.error("Error in getActiveRound:", error);
         throw error; // Re-throw to allow calling components to handle it
     }
};


/**
 * Saves/updates user predictions for the active round.
 * Expects an array of prediction objects (camelCase).
 * Sends camelCase payload to the backend.
 */
export const savePredictions = async (predictions: PredictionPayload[], token: string): Promise<void> => {
    // Backend expects { predictions: [...] } where each prediction uses camelCase keys
    const payload = {
        predictions: predictions.map(p => ({
            fixtureId: p.fixtureId,                 // Send camelCase
            predictedHomeGoals: p.predictedHomeGoals, // Send camelCase
            predictedAwayGoals: p.predictedAwayGoals, // Send camelCase
            // isJoker: p.isJoker // Add if joker is implemented (keep camelCase)
        }))
    };
    await fetchWithAuth('/predictions', { // Endpoint should accept camelCase
        method: 'POST',
        body: JSON.stringify(payload),
    }, token);
     // No return value needed, fetchWithAuth throws on error
};

// ========================================================
// ===== NEW FUNCTION: Generate Random Predictions ========
// ========================================================
/**
 * Calls the backend to generate random predictions for the user for the active round.
 * @param token - The user's authentication token.
 * @returns A promise resolving to an object with message and count.
 */
export const generateRandomUserPredictions = async (token: string): Promise<{ message: string; count: number }> => {
    const url = '/predictions/random'; // The new endpoint path
    console.log(`%c[api.ts] Calling generateRandomUserPredictions: ${url}`, 'color: magenta;');

    if (!token) {
        console.error('%c[generateRandomUserPredictions] No token provided!', 'color: red;');
        throw new Error("Authentication token is missing.");
    }

    try {
        // Using POST method as defined in the backend route
        const response = await fetchWithAuth(url, { method: 'POST' }, token);
        console.log(`%c[generateRandomUserPredictions] fetchWithAuth successful`, 'color: magenta;');

        const responseData = await response.json(); // Expect { message, count }

        // Basic validation of the response structure
        if (!responseData || typeof responseData.message !== 'string' || typeof responseData.count !== 'number') {
            console.error('%c[generateRandomUserPredictions] Invalid response format:', 'color: red;', responseData);
            throw new Error("Received invalid data format from server.");
        }

        console.log(`%c[generateRandomUserPredictions] Success response:`, 'color: magenta;', responseData);
        return responseData; // Return { message, count }

    } catch (error) {
         console.error(`%c[generateRandomUserPredictions] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         // Re-throw the error so the calling component can handle it (e.g., show toast)
         // If error is already an Error object, rethrow it, otherwise create a new one
         if (error instanceof Error) {
            throw error;
         } else {
            // Fallback for non-Error exceptions
            throw new Error('An unknown error occurred while generating random predictions.');
         }
    }
};
// ========================================================

/**
 * Fetches a list of completed rounds (for standings dropdown).
 * Uses getRounds which maps response to camelCase.
 */
export const getCompletedRounds = async (token: string): Promise<SimpleRound[]> => {
    const completedRounds: Round[] = await getRounds(token, 'COMPLETED');
    return completedRounds.map(({ roundId, name }) => ({ roundId, name }));
};

/**
 * Fetches the standings for a specific completed round or overall standings.
 * Assumes backend returns camelCase for standings.
 * Pass undefined or null for roundId to get overall standings.
 */
export const getStandings = async (token: string, roundId?: number | null): Promise<StandingEntry[]> => {
    const url = roundId ? `/standings?roundId=${roundId}` : '/standings';
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json();

    // Backend standings endpoint now provides camelCase response directly.
     if (!Array.isArray(rawData)) {
         console.error(`API Error: GET ${url} did not return an array. Response:`, rawData);
         return []; // Return empty array on unexpected response format
     }
    // Type assertion is safe if backend contract is maintained
    // Note: The type returned now includes the new fields defined in StandingEntry
    return rawData as StandingEntry[];
};


// == Admin Functions ==

/**
 * Fetches a list of rounds (Admin). Can optionally filter by status.
 * Backend GET /rounds returns snake_case, so map response here.
 */
export const getRounds = async (token: string, status?: Round['status']): Promise<Round[]> => {
    const url = status ? `/rounds?status=${status}` : '/rounds';
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error("API Error: GET /rounds (admin) did not return an array. Response:", rawData);
        return [];
    }
    // Map snake_case from backend to camelCase
    return mapArrayToCamelCase<Round>(rawData);
};

/**
 * Creates a new round (Admin).
 * Sends camelCase payload, backend POST /rounds handles it (assumed).
 * Backend returns snake_case, so map response here.
 */
export const createRound = async (roundData: CreateRoundPayload, token: string): Promise<Round> => {
    const response = await fetchWithAuth('/rounds', {
        method: 'POST',
        body: JSON.stringify(roundData), // Sending payload as is (name, deadline)
    }, token);
    const createdRaw = await response.json();
    // Map snake_case response to camelCase
    return toCamelCase<Round>(createdRaw);
};

/**
 * Updates the status of a specific round (Admin).
 * Sends camelCase payload { status: '...' }. Backend returns nothing (204).
 */
export const updateRoundStatus = async (roundId: number, payload: UpdateRoundStatusPayload, token: string): Promise<void> => {
    await fetchWithAuth(`/rounds/${roundId}/status`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    }, token);
     // No return value expected on success
};

// --- NEW: Function to update round details (name, deadline) ---
/**
 * Updates the details (name, deadline) of a specific round (Admin).
 * Sends camelCase payload. Backend returns updated round in snake_case.
 */
export const updateRoundDetails = async (roundId: number, payload: UpdateRoundPayload, token: string): Promise<Round> => {
    const endpoint = `/rounds/${roundId}`; // Target the specific round ID with PUT
    const response = await fetchWithAuth(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload), // Send { name?: "...", deadline?: "..." }
    }, token);

    // Check if the response includes content before trying to parse JSON
    if (response.status === 204 || !response.headers.get('content-type')?.includes('application/json')) {
        // Handle cases where backend might not return the updated object (though it should for PUT)
         console.warn(`Update round details for ID ${roundId} returned status ${response.status} or non-JSON content.`);
         // Optionally fetch the round again to get updated data, or throw an error
         // For now, let's assume success but log a warning. Ideally, backend returns the updated resource.
         // If fetching again: return getRounds(token).then(rounds => rounds.find(r => r.roundId === roundId));
         throw new Error(`Round updated, but no confirmation data received (Status: ${response.status}). Please refresh manually.`); // Or handle differently
    }

    const updatedRaw = await response.json();
    // Map snake_case response from backend to camelCase
    return toCamelCase<Round>(updatedRaw);
};


/**
 * Fetches all fixtures for a specific round (Admin).
 * Backend GET /rounds/:id/fixtures returns snake_case, so map response here.
 */
export const getRoundFixtures = async (roundId: number, token: string): Promise<Fixture[]> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, { method: 'GET' }, token);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error(`API Error: GET /rounds/${roundId}/fixtures did not return an array. Response:`, rawData);
        return [];
    }
     // Map snake_case array from backend to camelCase
    return mapArrayToCamelCase<Fixture>(rawData);
};


/**
 * Adds a new fixture to a specific round (Admin).
 * Sends camelCase payload.
 * Backend POST /rounds/:id/fixtures returns snake_case, so map response here.
 */
export const addFixture = async (roundId: number, fixtureData: AddFixturePayload, token: string): Promise<Fixture> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, {
        method: 'POST',
        body: JSON.stringify(fixtureData),
    }, token);

    if (!(response.status === 201 || response.status === 200)) {
         throw new Error(`Failed to add fixture, received status ${response.status}`);
    }
     if (!response.headers.get('content-type')?.includes('application/json')) {
         // Handle case where backend might return 201 Created with no body or non-JSON body
         console.warn(`Add fixture responded with status ${response.status} but non-JSON content.`);
         // Depending on need, might fetch the fixture list again or throw an error demanding a body
         throw new Error('Fixture added, but no confirmation data received.');
     }

    const createdRaw = await response.json();
    // Map snake_case response to camelCase
    return toCamelCase<Fixture>(createdRaw);
};

/**
 * Deletes a specific fixture and its associated predictions (Admin).
 */
export const deleteFixture = async (fixtureId: number, token: string): Promise<void> => {
    const endpoint = `/fixtures/${fixtureId}`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);
        if (response.status !== 204) { // Expect 204 No Content on successful DELETE
            console.warn(`Delete fixture responded with unexpected status: ${response.status}`);
            let body = ''; try { body = await response.text(); } catch {}
            throw new Error(`Delete fixture responded with status ${response.status}: ${body}`);
        }
         // No return needed on success
    } catch (error: unknown) {
        console.error(`Error deleting fixture ${fixtureId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while deleting the fixture.'); }
    }
};

/**
 * Submits the result for a specific fixture.
 * Sends camelCase payload.
 * Backend PUT /fixtures/:id/result returns snake_case, so map response here.
 */
export const enterFixtureResult = async (fixtureId: number, payload: ResultPayload, token: string): Promise<Fixture> => {
    const endpoint = `/fixtures/${fixtureId}/result`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(payload) }, token);
        // PUT often returns 200 OK with the updated resource, or 204 No Content
        if (response.status === 204) {
             console.warn("Fixture result updated successfully, but no updated data was returned (Status 204).");
             // Might need to fetch the fixture again if UI needs updated data immediately
             throw new Error("Fixture result updated, but no confirmation data received (Status 204). Refresh may be needed.");
         }
        if (response.headers.get('content-type')?.includes('application/json')) {
             const updatedRaw = await response.json();
             return toCamelCase<Fixture>(updatedRaw); // Map snake_case response
        }
        // Handle unexpected response (e.g., 200 OK but no JSON)
        throw new Error(`Fixture result update responded with status ${response.status} but unexpected content type.`);
    } catch (error: unknown) {
        console.error(`Error submitting result for fixture ${fixtureId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while submitting the fixture result.'); }
    }
};

/**
 * Triggers the scoring process for a specific CLOSED round (Admin).
 * Backend returns nothing (200 OK or 202 Accepted typically).
 */
export const triggerScoring = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}/score`;
    try {
        // Assume backend returns 200 or 202 on success, no body needed
        await fetchWithAuth(endpoint, { method: 'POST' }, token);
        console.log(`Scoring triggered successfully for round ${roundId}`);
    } catch (error: unknown) {
        console.error(`Error triggering scoring for round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while triggering scoring.'); }
    }
};

/**
 * Imports fixtures for a specific round from an external API (Admin).
 * Sends camelCase payload.
 * Backend POST /rounds/import/fixtures returns camelCase directly.
 */
export const importFixtures = async (payload: ImportFixturesPayload, token: string): Promise<{ message: string; count: number }> => {
    const endpoint = '/rounds/import/fixtures';
    try {
        const response = await fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(payload) }, token);
        // Expect 200 or 201 with JSON body
        if ((response.status === 201 || response.status === 200) && response.headers.get('content-type')?.includes('application/json')) {
            // Backend returns camelCase { message, count }
            return response.json();
        } else {
             let responseBody = ''; try { responseBody = await response.text(); } catch { /* ignore */ }
             throw new Error(`Fixture import responded with status ${response.status} but unexpected content: ${responseBody.substring(0, 100)}`);
        }
    } catch (error: unknown) {
        console.error(`Error importing fixtures for round ${payload.roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while importing fixtures.'); }
    }
};

/**
 * Triggers the generation of random results for all fixtures in a given round (Admin).
 * Backend POST /rounds/:id/fixtures/random-results returns camelCase directly.
 */
export const generateRandomResults = async (roundId: number, token: string): Promise<{ message: string; count: number }> => {
    const endpoint = `/rounds/${roundId}/fixtures/random-results`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'POST' }, token);
        // Expect 200 OK with JSON body
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
             // Backend returns camelCase { message, count }
             return response.json();
        } else {
             console.warn(`Generate random results responded with unexpected status: ${response.status}`);
             let responseBody = ''; try { responseBody = await response.text(); } catch { /* ignore */ }
             throw new Error(`Generate random results responded with status ${response.status} but unexpected content: ${responseBody.substring(0, 100)}`);
        }
    } catch (error: unknown) {
        console.error(`Error generating random results for round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while generating random results.'); }
    }
};

/**
 * Deletes a specific round and its associated data (Admin).
 */
export const deleteRound = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);
        if (response.status !== 204) { // Expect 204 No Content
            console.warn(`Delete round responded with unexpected status: ${response.status}`);
             let body = ''; try { body = await response.text(); } catch {}
             throw new Error(`Delete round responded with status ${response.status}: ${body}`);
        }
         // No return needed
    } catch (error: unknown) {
        console.error(`Error deleting round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while deleting the round.'); }
    }
};

// === ADD THIS FUNCTION AT THE END OF ADMIN FUNCTIONS ===
/**
 * Fetches potential fixtures from the external API based on competition and date range.
 */
export const fetchExternalFixtures = async (
    token: string,
    competitionCode: string,
    dateFrom: string, // Expect YYYY-MM-DD
    dateTo: string    // Expect YYYY-MM-DD
): Promise<PotentialFixture[]> => {
    const url = '/fixtures/fetch-external'; // Matches backend route
    console.log(`%c[api.ts] Calling fetchExternalFixtures: ${url}`, 'color: cyan;', { competitionCode, dateFrom, dateTo });

    if (!token) throw new Error("Authentication token is missing.");
    if (!competitionCode || !dateFrom || !dateTo) throw new Error("Competition code and date range are required.");

    try {
        const response = await fetchWithAuth(url, {
            method: 'POST',
            body: JSON.stringify({ competitionCode, dateFrom, dateTo }) // Send payload in body
        }, token);
        console.log(`%c[fetchExternalFixtures] fetchWithAuth successful`, 'color: cyan;');

        const data = await response.json(); // Expect backend to return array directly

        if (!Array.isArray(data)) {
            console.error('%c[fetchExternalFixtures] Invalid response format (expected array):', 'color: red;', data);
            throw new Error("Received invalid data format from server.");
        }

        console.log(`%c[fetchExternalFixtures] Success response (count: ${data.length}):`, 'color: cyan;', data);
        // Basic check on first item structure before casting
        if (data.length > 0 && (typeof data[0].externalId !== 'number' || typeof data[0].homeTeam !== 'string')) {
             console.error('%c[fetchExternalFixtures] Response array items have incorrect structure.', 'color: red;', data[0]);
             throw new Error("Received invalid fixture data structure from server.");
        }

        return data as PotentialFixture[]; // Cast to expected type

    } catch (error) {
         console.error(`%c[fetchExternalFixtures] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         // Re-throw the error so the calling component can handle it
         if (error instanceof Error) {
            throw error;
         } else {
            throw new Error('An unknown error occurred while fetching external fixtures.');
         }
    }
};

// === ADD THIS NEW FUNCTION ===
/**
 * Imports selected fixtures (previously fetched) into a specific round.
 */
export const importSelectedFixtures = async (
    token: string,
    roundId: number,
    // Pass only the necessary data for backend insertion
    fixturesToImport: { homeTeam: string; awayTeam: string; matchTime: string }[]
): Promise<{ message: string; count: number }> => { // Expect same response shape as matchday import
    const url = `/rounds/${roundId}/import-selected`; // Matches new backend route
    console.log(`%c[api.ts] Calling importSelectedFixtures for round ${roundId}`, 'color: olive;', { count: fixturesToImport.length });

    if (!token) throw new Error("Authentication token is missing.");
    if (!roundId || isNaN(roundId)) throw new Error("Valid Round ID is required.");
    if (!Array.isArray(fixturesToImport) || fixturesToImport.length === 0) {
        throw new Error("At least one fixture must be provided to import.");
    }

    try {
        const response = await fetchWithAuth(url, {
            method: 'POST',
            // Send in the expected { fixturesToImport: [...] } format
            body: JSON.stringify({ fixturesToImport: fixturesToImport })
        }, token);
        console.log(`%c[importSelectedFixtures] fetchWithAuth successful`, 'color: olive;');

        const responseData = await response.json(); // Expect { message, count }

        // Validate response structure
        if (!responseData || typeof responseData.message !== 'string' || typeof responseData.count !== 'number') {
             console.error('%c[importSelectedFixtures] Invalid response format:', 'color: red;', responseData);
             throw new Error("Received invalid data format from server after import.");
         }

        console.log(`%c[importSelectedFixtures] Success response:`, 'color: olive;', responseData);
        return responseData;

    } catch (error) {
        console.error(`%c[importSelectedFixtures] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
        throw error; // Re-throw
    }
};
// ============================
// ==========================================================

// --- NOTE on Case Mapping ---
// Consistent approach: Frontend uses camelCase internally. API functions map
// snake_case responses from backend to camelCase using helpers. Payloads
// are sent as camelCase, assuming backend endpoints handle/expect this or map it internally.
// Specific endpoints confirmed to return camelCase (like /login, /rounds/active, /standings)
// skip explicit mapping but rely on backend contract.