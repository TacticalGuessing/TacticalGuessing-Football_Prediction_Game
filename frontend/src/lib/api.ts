// frontend/src/lib/api.ts

// Define the base URL for the API
// Ensure NEXT_PUBLIC_API_URL is set in your .env.local file
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'; // Adjusted default

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

export interface StandingEntry {
    userId: number;
    points: number; // Check if backend sends points or points_awarded
    name: string;
    // rank?: number; // Frontend calculates rank
}

// --- Admin Specific Interfaces ---

// Payload for creating a round
export interface CreateRoundPayload {
    name: string;
    deadline: string; // Expecting ISO format string
}

// Payload for updating round status
export interface UpdateRoundStatusPayload {
    status: 'SETUP' | 'OPEN' | 'CLOSED'; // Only allow setting these explicitly
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
            newObj[newKey] = obj[key];
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
     return arr.map(item => toCamelCase<T>(item));
};


// --- API Functions ---

// == User Facing Functions ==

/**
 * Registers a new user.
 */
export const registerUser = async (userData: RegisterUserData): Promise<void> => {
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
    const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }, null);
    // Assume backend sends camelCase or needs mapping here if not
    const data = await response.json();
    // Perform mapping if necessary, e.g., return toCamelCase<AuthResponse>(data);
    return data as Promise<AuthResponse>;
};

/**
 * Fetches the currently active round ('OPEN' status), its fixtures, and the logged-in user's predictions.
 * Explicitly maps the response to ensure frontend uses camelCase.
 */
export const getActiveRound = async (token: string): Promise<ActiveRoundResponse | null> => {
    try {
        const response = await fetchWithAuth('/rounds/active', { method: 'GET' }, token);
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null; // Handle case where no active round exists (backend returns 200 with null or 204)
        }
        const rawData = await response.json();
        if (!rawData) return null; // Explicitly handle null response body

        // Backend /active route now handles mapping, but we double-check/map here for safety
        const mappedRound: ActiveRoundResponse = {
            roundId: rawData.roundId,
            name: rawData.name,
            deadline: rawData.deadline,
            status: rawData.status,
            // Ensure fixtures within the response are also mapped if backend doesn't guarantee it
            fixtures: Array.isArray(rawData.fixtures)
                ? rawData.fixtures.map((f: unknown) => toCamelCase<FixtureWithPrediction>(f))
                : [],
        };
        return mappedRound;
    } catch (error) {
         if (error instanceof Error && error.message.includes('404')) {
             // If fetchWithAuth throws a 404, treat it as "no active round"
             console.log("No active round found (404).");
             return null;
         }
         // Re-throw other errors
         console.error("Error in getActiveRound:", error);
         throw error;
     }
};


/**
 * Saves/updates user predictions for the active round.
 * Expects an array of prediction objects (camelCase).
 */
export const savePredictions = async (predictions: PredictionPayload[], token: string): Promise<void> => {
    // Backend expects { predictions: [...] } where each prediction uses snake_case keys
    // Map frontend camelCase PredictionPayload to backend snake_case structure
    const payload = {
        predictions: predictions.map(p => ({
            fixture_id: p.fixtureId,
            predicted_home_goals: p.predictedHomeGoals,
            predicted_away_goals: p.predictedAwayGoals,
            // is_joker: p.isJoker ?? false // Map if joker is implemented
        }))
    };
    await fetchWithAuth('/predictions', { // Endpoint adjusted based on backend routes/predictions.js
        method: 'POST',
        body: JSON.stringify(payload),
    }, token);
     // No return value needed, fetchWithAuth throws on error
};

/**
 * Fetches a list of completed rounds (for standings dropdown).
 * Maps the result to SimpleRound[].
 */
export const getCompletedRounds = async (token: string): Promise<SimpleRound[]> => {
    const completedRounds: Round[] = await getRounds(token, 'COMPLETED'); // getRounds already maps to camelCase
    // Map full Round objects to SimpleRound objects
    return completedRounds.map(({ roundId, name }) => ({ roundId, name }));
};

/**
 * Fetches the standings for a specific completed round.
 * Assumes backend returns camelCase or maps here.
 */
export const getStandingsForRound = async (roundId: number, token: string): Promise<StandingEntry[]> => {
    const response = await fetchWithAuth(`/standings?roundId=${roundId}`, { method: 'GET' }, token);
    const rawData = await response.json();
    // Map if backend sends snake_case (e.g., user_id)
    return mapArrayToCamelCase<StandingEntry>(rawData);
    // return rawData as Promise<StandingEntry[]>; // If backend sends camelCase
};


// == Admin Functions ==

/**
 * Fetches a list of rounds (Admin). Can optionally filter by status.
 * Requires admin authentication. Returns rounds mapped to camelCase.
 */
export const getRounds = async (token: string, status?: Round['status']): Promise<Round[]> => {
    const url = status ? `/rounds?status=${status}` : '/rounds'; // Uses admin GET /rounds endpoint
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error("API Error: GET /rounds (admin) did not return an array. Response:", rawData);
        return [];
    }
    // Map snake_case (e.g., round_id) from backend to camelCase (roundId)
    return mapArrayToCamelCase<Round>(rawData);
};

/**
 * Creates a new round (Admin).
 * Requires admin authentication. Returns the created round mapped to camelCase.
 */
export const createRound = async (roundData: CreateRoundPayload, token: string): Promise<Round> => {
    const response = await fetchWithAuth('/rounds', { // Uses admin POST /rounds endpoint
        method: 'POST',
        body: JSON.stringify(roundData), // Send camelCase payload, backend handles it
    }, token);
    const createdRaw = await response.json();
    // Map response from snake_case to ensure frontend gets camelCase
    return toCamelCase<Round>(createdRaw);
};

/**
 * Updates the status of a specific round (Admin).
 * Requires admin authentication.
 */
export const updateRoundStatus = async (roundId: number, payload: UpdateRoundStatusPayload, token: string): Promise<void> => {
    await fetchWithAuth(`/rounds/${roundId}/status`, { // Uses admin PUT /rounds/:roundId/status
        method: 'PUT',
        body: JSON.stringify(payload), // Send { status: 'NEW_STATUS' }
    }, token);
    // No return value needed, fetchWithAuth throws on error
};

/**
 * Fetches all fixtures for a specific round (Admin).
 * Requires admin authentication. Returns fixtures mapped to camelCase.
 */
export const getRoundFixtures = async (roundId: number, token: string): Promise<Fixture[]> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, { method: 'GET' }, token); // Uses admin GET /rounds/:roundId/fixtures
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error(`API Error: GET /rounds/${roundId}/fixtures did not return an array. Response:`, rawData);
        return [];
    }
     // Map snake_case array from backend to camelCase Fixture array
    return mapArrayToCamelCase<Fixture>(rawData);
};


/**
 * Adds a new fixture to a specific round (Admin).
 * Requires admin authentication. Returns the created fixture mapped to camelCase.
 */
export const addFixture = async (roundId: number, fixtureData: AddFixturePayload, token: string): Promise<Fixture> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, { // Uses admin POST /rounds/:roundId/fixtures
        method: 'POST',
        body: JSON.stringify(fixtureData), // Send camelCase payload
    }, token);

    // Check if response is likely JSON before parsing
    if (response.status !== 201 && response.status !== 200) { // Expect 201 normally
         throw new Error(`Failed to add fixture, received status ${response.status}`);
    }
     if (!response.headers.get('content-type')?.includes('application/json')) {
         throw new Error('Received non-JSON response after adding fixture');
     }

    const createdRaw = await response.json();
    // Map response from snake_case to camelCase Fixture
    return toCamelCase<Fixture>(createdRaw);
};

/**
 * Deletes a specific fixture and its associated predictions (Admin).
 * Requires admin authentication.
 * @param fixtureId - The ID of the fixture to delete.
 * @param token - The user's JWT authentication token.
 * @returns Promise<void>
 * @throws Throws an error if the API call fails.
 */
export const deleteFixture = async (fixtureId: number, token: string): Promise<void> => {
    const endpoint = `/fixtures/${fixtureId}`; // Matches backend DELETE route

    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);

        // Expecting 204 No Content on success. fetchWithAuth handles non-ok statuses.
        if (response.status !== 204) {
            // Optional: Handle unexpected success statuses if needed
            console.warn(`Delete fixture responded with unexpected status: ${response.status}`);
            // Attempt to read body for more info if available
             try {
                 const body = await response.text();
                 throw new Error(`Delete fixture responded with status ${response.status}: ${body}`);
             } catch {
                 throw new Error(`Delete fixture responded with status ${response.status}`);
             }
        }
        // No return needed for 204
    } catch (error: unknown) {
        console.error(`Error deleting fixture ${fixtureId}:`, error);
        if (error instanceof Error) {
            throw error; // Re-throw the formatted error
        } else {
            throw new Error('An unknown error occurred while deleting the fixture.');
        }
    }
};

/**
 * Submits the result for a specific fixture.
 * Requires admin authentication. Returns the updated fixture mapped to camelCase.
 */
export const enterFixtureResult = async (fixtureId: number, payload: ResultPayload, token: string): Promise<Fixture> => {
    // Backend endpoint uses PUT /fixtures/:fixtureId/result (from fixtures.js)
    const endpoint = `/fixtures/${fixtureId}/result`;

    try {
        const response = await fetchWithAuth(endpoint, {
            method: 'PUT',
            // Send camelCase payload, backend PUT /fixtures/:id/result handles it
            body: JSON.stringify(payload)
        }, token);

        if (response.status === 204) {
            throw new Error("Fixture result updated successfully, but no updated data was returned (Status 204).");
        }
        if (response.headers.get('content-type')?.includes('application/json')) {
             const updatedRaw = await response.json();
             return toCamelCase<Fixture>(updatedRaw);
        }
        throw new Error(`Fixture result update responded with status ${response.status} but unexpected content type.`);

    } catch (error: unknown) {
        console.error(`Error submitting result for fixture ${fixtureId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while submitting the fixture result.'); }
    }
};

/**
 * Triggers the scoring process for a specific CLOSED round.
 * Requires admin authentication. Backend handles score calculation and status update.
 */
export const triggerScoring = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}/score`; // Backend endpoint
    try {
        await fetchWithAuth(endpoint, { method: 'POST' }, token);
        console.log(`Scoring triggered successfully for round ${roundId}`);
    } catch (error: unknown) {
        console.error(`Error triggering scoring for round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while triggering scoring.'); }
    }
};

/**
 * Imports fixtures for a specific round from an external API (football-data.org).
 * Requires admin authentication.
 */
// Using specific return type inline as ImportFixturesResponse might be removed
export const importFixtures = async (payload: ImportFixturesPayload, token: string): Promise<{ message: string; count: number }> => {
    const endpoint = '/rounds/import/fixtures'; // Backend endpoint
    try {
        const response = await fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(payload) }, token);
        if ((response.status === 201 || response.status === 200) && response.headers.get('content-type')?.includes('application/json')) {
            return response.json(); // Let TS infer { message, count }
        } else {
             let responseBody = '';
             try { responseBody = await response.text(); } catch { /* ignore */ }
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
 * Sets fixtures to FINISHED status.
 * @param roundId - The ID of the round.
 * @param token - The user's JWT authentication token.
 * @returns Promise<{ message: string; count: number }> - Success message and count of updated fixtures.
 * @throws Throws an error if the API call fails.
 */
export const generateRandomResults = async (roundId: number, token: string): Promise<{ message: string; count: number }> => {
    // Endpoint matches the new backend POST route in rounds.js
    const endpoint = `/rounds/${roundId}/fixtures/random-results`;

    try {
        // This action doesn't need a request body
        const response = await fetchWithAuth(endpoint, { method: 'POST' }, token);

        // Expecting 200 OK on success with a JSON body { message, count }
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
             return response.json(); // Let TS infer return type
        } else {
             console.warn(`Generate random results responded with unexpected status: ${response.status}`);
             let responseBody = '';
             try { responseBody = await response.text(); } catch { /* ignore */ }
             throw new Error(`Generate random results responded with status ${response.status} but unexpected content: ${responseBody.substring(0, 100)}`);
        }
    } catch (error: unknown) {
        console.error(`Error generating random results for round ${roundId}:`, error);
        if (error instanceof Error) {
            throw error; // Re-throw the formatted error
        } else {
            throw new Error('An unknown error occurred while generating random results.');
        }
    }
};

// *** ADD DELETE ROUND FUNCTION HERE ***
/**
 * Deletes a specific round and its associated fixtures and predictions (Admin).
 * Requires admin authentication.
 * @param roundId - The ID of the round to delete.
 * @param token - The user's JWT authentication token.
 * @returns Promise<void>
 * @throws Throws an error if the API call fails.
 */
export const deleteRound = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}`; // Matches backend DELETE route

    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);

        if (response.status !== 204) { // Expect 204 No Content on success
            console.warn(`Delete round responded with unexpected status: ${response.status}`);
             try {
                 const body = await response.text();
                 throw new Error(`Delete round responded with status ${response.status}: ${body}`);
             } catch {
                 throw new Error(`Delete round responded with status ${response.status}`);
             }
        }
        // No return needed for 204
    } catch (error: unknown) {
        console.error(`Error deleting round ${roundId}:`, error);
        if (error instanceof Error) { throw error; } // Re-throw formatted error
        else { throw new Error('An unknown error occurred while deleting the round.'); }
    }
};
// *** END ADD DELETE ROUND FUNCTION ***