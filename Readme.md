# Core Passkeys Wrapper Library

A JavaScript wrapper library that abstracts the Mastercard Passkeys SDK integration for seamless authentication flows within the Core system ecosystem.

## Overview

This library provides a simplified interface for integrating Mastercard's Passkeys authentication into Core system applications. It handles the complexity of SDK initialization, data transformation, and error handling while providing a clean, consistent API for authentication flows.

## Features

- **Simplified Initialization**: Easy setup with environment-aware configuration
- **Automatic Core API Integration**: Seamlessly fetches token information from Core APIs
- **Data Transformation**: Handles mapping between Core data formats and Mastercard SDK requirements
- **Complete Authentication Flow**: Manages the entire authentication process from start to finish
- **Consistent Error Handling**: Standardized error types and messages
- **Environment Support**: Works with local, sandbox, and production environments

## Installation

Include the library in your project:

```javascript
import { 
  init, 
  executeAuthenticate, 
  isReady, 
  CorePasskeysError 
} from './core-passkeys-wrapper.js';
```

## Quick Start

```javascript
// Initialize the wrapper
await CorePasskeys.init({
  environment: 'sandbox', // 'sandbox', 'production', or 'local'
  locale: 'es_CL'         // e.g., 'en_US', 'es_CL'
});

// Execute authentication
try {
  const result = await CorePasskeys.executeAuthenticate(
    {
      managerCode: 'your-manager-code',
      merchantCode: 'your-merchant-uuid',
      tokenCode: 'your-token-uuid',
      authMethod: 'passkey',          // '3ds' or 'passkey'
      authReason: 'payment',          // 'login', 'payment', 'enroll'
      amount: {
        value: '99.99',
        currency: 'USD'
      },
      acquirerMerchantId: '550e8400',
      acquirerBIN: '444444',
      merchantCategoryCode: '5734',
      merchantCountryCode: 'US'
    },
    {
      environment: 'sandbox',
      locale: 'es_CL'
    }
  );
  
  console.log('Authentication successful:', result);
} catch (error) {
  console.error('Authentication failed:', error);
}
```

## API Reference

### `init(config)`
Initializes the wrapper library. Must be called once before any other function.

**Parameters:**
- `config.environment`: `'sandbox'`, `'production'`, or `'local'`
- `config.locale`: Locale code (e.g., `'en_US'`, `'es_CL'`)

### `isReady()`
Returns the initialization status of the wrapper.

**Returns:** `boolean` - True if the wrapper has been initialized.

### `executeAuthenticate(params, config)`
Executes the complete authentication flow: initialization, fetching coreData, and authentication.

**Parameters:**
- `params.managerCode`: The manager code (e.g., 'azul')
- `params.merchantCode`: The merchant UUID
- `params.tokenCode`: The token UUID
- `params.authMethod`: Authentication method type ('3ds' or 'passkey')
- `params.authReason`: Authentication reason ('login', 'payment', 'enroll')
- `params.amount`: Transaction amount details
- `params.amount.value`: The transaction amount
- `params.amount.currency`: The transaction currency code
- `params.acquirerMerchantId`: The acquirer merchant ID
- `params.acquirerBIN`: The acquirer BIN
- `params.merchantCategoryCode`: The merchant category code
- `params.merchantCountryCode`: The merchant country code
- `config`: Configuration for initialization (same as `init()`)

**Returns:** `Promise<Object>` - The authentication result.

### `authenticate(coreData)`
Main function to initiate a passkey authentication flow (lower-level API).

### `getTokenBrandInfo(params)`
Fetches token brand information from the Core API.

## Error Handling

The library uses a custom error class `CorePasskeysError` that includes:

- `message`: Human-readable error message
- `code`: Programmatic error code for handling
- `name`: Always 'CorePasskeysError'

Common error codes:
- `INVALID_INPUT`: Missing or invalid parameters
- `CORE_API_ERROR`: Failed to fetch data from Core API
- `NETWORK_ERROR`: Network issues during authentication
- `TIMEOUT`: Authentication request timed out
- `AUTH_FAILED`: General authentication failure

## Environments

The library supports three environments:

1. **local**: Development environment (http://localhost:18080)s
2. **sandbox**: Mastercard sandbox environment
3. **production**: Mastercard production environment

## Response Format

Successful authentication returns an object with:

```javascript
{
  assuranceData: {},           // Mastercard assurance data
  authenticationStatus: "",    // Authentication status
  authenticationResult: {},    // Detailed authentication result
  srcCorrelationId: ""         // Correlation ID for tracking
}
```

## Example Usage

See `main.html` for a complete working example that demonstrates:

1. Library initialization
2. Complete authentication flow execution
3. Error handling
4. Response processing

## Browser Support

This library requires modern browser features:
- ES6 modules support
- Fetch API
- Crypto API (for UUID generation)

## Development

To test the library locally:

1. Serve the files with a local web server
2. Open `main.html` in a browser
3. Use the browser console to monitor execution

## License

This library is designed for internal use within the Core system ecosystem.

## Support

For issues or questions, please refer to the internal documentation or contact the development team.