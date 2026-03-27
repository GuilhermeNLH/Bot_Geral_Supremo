const { Client } = require("@notionhq/client");

class NotionClient {
    constructor(apiKey) {
        this.notion = new Client({ auth: apiKey });
    }

    async createDatabase(databaseName) {
        try {
            const response = await this.notion.databases.create({
                parent: {
                    type: "page_id",
                    page_id: "your_page_id", // replace with your page ID
                },
                title: [
                    {
                        type: "text",
                        text: {
                            content: databaseName,
                        },
                    },
                ],
                properties: {
                    Name: {
                        title: {},
                    },
                },
            });
            return response;
        } catch (error) {
            console.error("Error creating database:", error);
            throw error;
        }
    }

    async getDatabase(databaseId) {
        try {
            const response = await this.notion.databases.retrieve({ database_id: databaseId });
            return response;
        } catch (error) {
            console.error("Error retrieving database:", error);
            throw error;
        }
    }

    async queryDatabase(databaseId, filter = {}) {
        try {
            const response = await this.notion.databases.query({ database_id: databaseId, filter });
            return response.results;
        } catch (error) {
            console.error("Error querying database:", error);
            throw error;
        }
    }

    async createPage(databaseId, properties) {
        try {
            const response = await this.notion.pages.create({
                parent: { database_id: databaseId },
                properties,
            });
            return response;
        } catch (error) {
            console.error("Error creating page:", error);
            throw error;
        }
    }
}

module.exports = NotionClient;