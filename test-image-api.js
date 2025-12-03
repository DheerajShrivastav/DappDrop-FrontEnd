#!/usr/bin/env node

// Test script to check campaign image data
const fetch = require('node-fetch');

async function testCampaignImage() {
    try {
        // Test campaign ID 1 (adjust as needed)
        const campaignId = 1;

        console.log(`Testing campaign ${campaignId}...`);
        console.log('Fetching from API:', `http://localhost:3000/api/campaigns/${campaignId}/image`);

        const response = await fetch(`http://localhost:3000/api/campaigns/${campaignId}/image`);
        console.log('Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Response data:', JSON.stringify(data, null, 2));
        } else {
            const errorText = await response.text();
            console.log('Error response:', errorText);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testCampaignImage();
