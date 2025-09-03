// core-passkeys-wrapper.js
import { 
    initMastercardSdk, 
    getMastercardSdk, 
    mapAuthReason, 
    mapAuthMethodType
} from './mastercard-config.js';

let isInitialized = false;

/**
 * Initializes the wrapper library. Must be called once before any other function.
 * @param {Object} config - Configuration object for the wrapper
 * @param {string} config.environment - 'sandbox' or 'production'
 * @param {string} config.locale - e.g., 'en_US', 'es_CL'
 */
export async function init(config) {
    if (isInitialized) {
        console.warn('CorePasskeysWrapper is already initialized.');
        return;
    }
    // Initialize the Mastercard SDK under the hood
    await initMastercardSdk(config);
    isInitialized = true;
}

/**
 * Returns the initialization status of the wrapper.
 * @returns {boolean} True if the wrapper has been initialized.
 */
export function isReady() {
    return isInitialized;
}

/**
 * Main function to initiate a passkey authentication flow.
 * @param {Object} coreData - The data object provided by the Core API.
 * @returns {Promise<Object>} - A promise resolving to a simplified, Core-friendly response.
 */
export async function authenticate(coreData) {
    // 1. Check if the wrapper is initialized or get the already initialized SDK instance
    if (!isInitialized) {
        throw new CorePasskeysError('CorePasskeysWrapper not initialized. Please call init() first.');
    }
    const sdk = getMastercardSdk();

    // 2. TRANSLATION: Map Core Data -> Mastercard Payload
    const mastercardPayload = {
        srcCorrelationId:  generateUUID(),
        serviceId: coreData.serviceId,
        srcClientId: coreData.srcClientId,
        traceId: generateUUID(),
        accountReference: {
            srcDigitalCardId: coreData.paymentToken // THIS IS THE ONE
        },
        authenticationMethod: {
            authenticationMethodType: mapAuthMethodType(coreData.authType),
            authenticationSubject: "CARDHOLDER", // This is likely always the same
        },
        authenticationContext: {
            authenticationReasons: [mapAuthReason(coreData.reason)],
            acquirerMerchantId: coreData.acquirerMerchantId,
            acquirerBIN: coreData.acquirerBIN,
            dpaData: {
                dpaName: coreData.dpaName,
                dpaUri: coreData.dpaName,
            },
            dpaTransactionOptions: {
                transactionAmount: {
                    transactionAmount: coreData.amount.value.toString(),
                    transactionCurrencyCode: coreData.amount.currency,
                },
                dpaLocale: coreData.locale || "es_CL",
                threeDsInputData: {
                    billingAddress: mapBillingAddress(coreData.customer) // Use a helper function
                },
                merchantCategoryCode: coreData.merchantCategoryCode || "0000", // Sensible default
                merchantCountryCode: coreData.merchantCountryCode || "US", // Sensible default
            }
        }
    };

    // 3. Call the Mastercard SDK with the translated payload
    try {
        console.log("Calling Mastercard SDK with payload:", mastercardPayload);
        const sdkResponse = await sdk.authenticate(mastercardPayload);
        
        // 4. Translate the Mastercard-specific response to a Core-friendly format
        return translateSdkResponse(sdkResponse);
        
    } catch (error) {
        console.error("Mastercard SDK authentication error:", error);
        // 5. Translate Mastercard errors to a standard Core error
        throw translateSdkError(error);
    }
}

// --- Internal Helper Functions ---

/**
 * Generates a UUID v4. Uses crypto.randomUUID() if available, otherwise a fallback.
 * @returns {string} A UUID v4 string.
 */
function generateUUID() {
    try {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    } catch (e) {
        // Final fallback if crypto is completely unavailable
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

/**
 * Maps a Core customer object to the Mastercard billingAddress structure.
 * @param {Object} customer - The Core customer data object.
 * @returns {Object} The Mastercard billingAddress object.
 */
function mapBillingAddress(customer) {
    // This function provides a safe mapping. If Core's structure is different,
    // this is where you handle the transformation.
    return {
        name: customer?.billingName || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim(),
        line1: customer?.billingAddress?.line1 || customer?.address?.line1 || '',
        line2: customer?.billingAddress?.line2 || customer?.address?.line2 || '',
        state: customer?.billingAddress?.state || customer?.address?.state || '',
        zip: customer?.billingAddress?.zip || customer?.address?.zip || customer?.billingAddress?.postalCode || customer?.address?.postalCode || '',
        countryCode: customer?.billingAddress?.countryCode || customer?.address?.countryCode || 'US' // Sensible default
    };
}

/**
 * Translates the Mastercard SDK response into a simpler, Core-friendly format.
 * @param {Object} sdkResponse - The raw response from the Mastercard SDK.
 * @returns {Object} A simplified response for the Core API.
 */
function translateSdkResponse(sdkResponse) {
    // This is a crucial part of the wrapper: hiding Mastercard's complexity.
    // Extract only the fields the Core API cares about.

    const coreResponse = {
        // TODO check Core needs for response
        isSuccessful: sdkResponse.status === 'SUCCESS' || sdkResponse.status === 'AUTHENTICATED',
        status: sdkResponse.status, // e.g., 'SUCCESS', 'FAILED', 'CHALLENGE_REQUIRED'
        correlationId: sdkResponse.srcCorrelationId,
        timestamp: new Date().toISOString()
    };

    return coreResponse;
}

/**
 * Translates Mastercard SDK errors into standardized Core errors.
 * @param {Error} sdkError - The error thrown by the Mastercard SDK.
 * @returns {CorePasskeysError} A custom error for the Core API.
 */
function translateSdkError(sdkError) {
    let message = 'Authentication failed';
    let code = 'AUTH_FAILED';

    if (sdkError.message?.includes('network') || sdkError.message?.includes('fetch')) {
        message = 'Network error occurred during authentication.';
        code = 'NETWORK_ERROR';
    } else if (sdkError.message?.includes('timeout')) {
        message = 'Authentication request timed out.';
        code = 'TIMEOUT';
    } else if (sdkError.message?.includes('invalid') || sdkError.message?.includes('validation')) {
        message = 'Invalid request data provided.';
        code = 'INVALID_INPUT';
    }

    return new CorePasskeysError(`${message} (Original: ${sdkError.message})`, code);
}

// --- Custom Error Class ---
/**
 * Custom error class for Core Passkeys wrapper errors.
 */
export class CorePasskeysError extends Error {
    /**
     * Creates a new CorePasskeysError.
     * @param {string} message - The error message.
     * @param {string} code - A short error code for programmatic handling.
     */
    constructor(message, code = 'UNKNOWN_ERROR') {
        super(message);
        this.name = 'CorePasskeysError';
        this.code = code;
    }
}