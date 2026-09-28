import createMailCampaign from '~~/server/utils/createMailCampaign';
export default defineEventHandler((event) =>
  createMailCampaign(event, getRouterParam(event, 'slug'))
);
