// services/graphEmailChecker.js
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');

class GraphEmailChecker {
    async checkEmailStatus(account, messageId) {
        try {
            console.log(`📊 Graph API: Checking message ${messageId} for ${account.email}`);

            const client = await this.getGraphClient(account);

            // Clean the messageId - remove angle brackets if present
            const cleanMessageId = messageId.replace(/[<>]/g, '');

            console.log(`🔍 Searching for message with ID: ${cleanMessageId}`);

            // Search for message by InternetMessageId
            const messages = await client
                .api('/me/messages')
                .filter(`internetMessageId eq '${cleanMessageId}'`)
                .select('id,subject,parentFolderId,isRead,receivedDateTime')
                .top(1)
                .get();

            console.log(`📊 Graph API found ${messages.value.length} messages`);

            if (messages.value.length > 0) {
                const message = messages.value[0];
                console.log(`✅ Graph API: Email found with subject: "${message.subject}"`);

                const isInInbox = await this.isMessageInInbox(client, message.parentFolderId);

                return {
                    success: true,
                    folder: isInInbox ? 'INBOX' : 'OTHER',
                    found: true,
                    deliveredInbox: isInInbox,
                    subject: message.subject,
                    receivedDateTime: message.receivedDateTime
                };
            }

            console.log(`❌ Graph API: Email not found with Message-ID: ${cleanMessageId}`);
            return {
                success: true,
                folder: 'NOT_FOUND',
                found: false,
                deliveredInbox: false
            };

        } catch (error) {
            console.error('❌ Graph API check failed:', error);

            // Provide more detailed error information
            if (error.statusCode === 401) {
                throw new Error('Graph API Authentication failed - check Azure credentials');
            } else if (error.statusCode === 403) {
                throw new Error('Graph API Permission denied - check Mail.Read permission');
            } else if (error.statusCode === 400) {
                throw new Error('Graph API Bad request - check parameters');
            } else {
                throw new Error(`Graph API error: ${error.message}`);
            }
        }
    }

    async isMessageInInbox(client, folderId) {
        try {
            const folder = await client.api(`/me/mailFolders/${folderId}`).get();
            const isInbox = folder.displayName === 'Inbox';
            console.log(`📁 Graph API: Message in folder: "${folder.displayName}" (Inbox: ${isInbox})`);
            return isInbox;
        } catch (error) {
            console.error(`❌ Could not determine folder: ${error.message}`);
            // If we can't determine the folder, assume it's not in inbox
            return false;
        }
    }

    async getGraphClient(account) {
        // Validate required Azure credentials
        if (!account.azure_tenant_id) {
            throw new Error('Missing azure_tenant_id for Graph API');
        }
        if (!account.azure_client_id) {
            throw new Error('Missing azure_client_id for Graph API');
        }
        if (!account.azure_client_secret) {
            throw new Error('Missing azure_client_secret for Graph API');
        }

        console.log(`🔐 Creating Graph client for tenant: ${account.azure_tenant_id}`);

        const credential = new ClientSecretCredential(
            account.azure_tenant_id,
            account.azure_client_id,
            account.azure_client_secret
        );

        return Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    try {
                        const token = await credential.getToken('https://graph.microsoft.com/.default');
                        console.log(`✅ Graph API token acquired successfully`);
                        return token.token;
                    } catch (tokenError) {
                        console.error('❌ Token acquisition failed:', tokenError);
                        throw new Error(`Azure authentication failed: ${tokenError.message}`);
                    }
                }
            }
        });
    }
}

module.exports = GraphEmailChecker;