const News = Parse.Object.extend('News');

Parse.Cloud.define('v1-get-news', async (req) => {
    const queryNews = new Parse.Query(News);
    queryNews.ascending('order');
    const news = await queryNews.find({ useMasterKey: true });
    return news.map((n) => formatNews(n.toJSON()));
}, {
    requireUser: true
});

function formatNews (n) {
    return {
        id: n.objectId,
        title: n.title,
        description: n.description,
        image: n.image.url,
        url: n.url,
        type: n.type,
        order: n.order
    }
}
