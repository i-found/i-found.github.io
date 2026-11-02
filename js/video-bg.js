/* =========================================================================
   音乐页「随机视频背景」全站配置（7 张专辑播放页共用这一个文件）
   -------------------------------------------------------------------------
   以后加视频只需要改下面两处：
   1) videoBgPool：追加一条 {src, poster, cover}
        src    —— 背景视频（建议 1920×1080、h264、去音轨，2MB 左右）
        poster —— 首帧图，加载时兜底，不会黑屏
        cover  —— 圆形唱片封面（从视频里裁 1:1）
   2) videoBgTotalSongs：全站歌曲总数（新增歌曲/专辑后同步改这个数字）
  3) videoBgBySong：给某一首歌锁定专属背景，键是播放页 data 里的 song 字段，
        格式与池子里的条目一样；锁定的视频不要再放进 videoBgPool（避免别的歌也随机到）
  4) 改完本文件（或任何 js/css/图片/视频）在站点根目录跑一次：
        python _stamp_version.py
     它会把所有引用里的 ?v= 换成文件内容哈希，不用再手改版本号
     —— GitHub Pages 对 .js 是 4 小时强缓存，不带版本号线上会一直跑旧代码

   概率规则（按需求）：
   概率 = 视频数 / 歌曲总数，钳制在 10% ~ 50% 之间；
   一轮 = 连续 10 次换歌（进页面播放第 1 首算第 1 次，之后每次切歌 +1）；
   每轮出现次数固定 = round(概率 × 10)，位置洗牌随机（可连续、可头尾），
   轮与轮之间重新抽，下一轮同样必定出现 N 次。
   ========================================================================= */
(function(){
    /* ---- 视频池：只在末尾追加，不要打乱顺序（封面圆图与视频一一对应） ---- */
    var videoBgPool=[
        {src:"../../vid/dark-night.mp4?v=5f1a9c63", poster:"../../vid/dark-night.jpg?v=bd340811", cover:"../../vid/dark-night-disc.jpg?v=f7965580"},
        {src:"../../vid/within-monochrome.mp4?v=c82322ef", poster:"../../vid/within-monochrome.jpg?v=2e42f748", cover:"../../vid/within-monochrome-disc.jpg?v=293b2934"},
        {src:"../../vid/seaside-rain.mp4?v=bf00a867", poster:"../../vid/seaside-rain.jpg?v=d4dc9541", cover:"../../vid/seaside-rain-disc.jpg?v=feaaa837"},
        {src:"../../vid/dark-leaf.mp4?v=15e5e7ca", poster:"../../vid/dark-leaf.jpg?v=bceaee91", cover:"../../vid/dark-leaf-disc.jpg?v=35acfd40"},
        {src:"../../vid/misty-valley.mp4?v=59cc0d1e", poster:"../../vid/misty-valley.jpg?v=693b1939", cover:"../../vid/misty-valley-disc.jpg?v=b15b951b"},
        {src:"../../vid/girl-ame-13.mp4?v=4b1a4eec", poster:"../../vid/girl-ame-13.jpg?v=bffb32e2", cover:"../../vid/girl-ame-13-disc.jpg?v=4faf6ec6"},
        {src:"../../vid/firewatch-tower.mp4?v=33ebffaa", poster:"../../vid/firewatch-tower.jpg?v=60f80758", cover:"../../vid/firewatch-tower-disc.jpg?v=0cba4256"},
        {src:"../../vid/sandblack.mp4?v=2498a78e", poster:"../../vid/sandblack.jpg?v=21756e91", cover:"../../vid/sandblack-disc.jpg?v=25ea734d"},
        {src:"../../vid/temporal-acceleration.mp4?v=4c5a3eed", poster:"../../vid/temporal-acceleration.jpg?v=af219e70", cover:"../../vid/temporal-acceleration-disc.jpg?v=61cf2675"},
        {src:"../../vid/anime-girl-night.mp4?v=213b434f", poster:"../../vid/anime-girl-night.jpg?v=14d09311", cover:"../../vid/anime-girl-night-disc.jpg?v=5b3fe246"},
        {src:"../../vid/moon-touch.mp4?v=5e7b6bbe", poster:"../../vid/moon-touch.jpg?v=805e992c", cover:"../../vid/moon-touch-disc.jpg?v=3a198459"},
        {src:"../../vid/endless-pain.mp4?v=4bc8253e", poster:"../../vid/endless-pain.jpg?v=ff25a891", cover:"../../vid/endless-pain-disc.jpg?v=fe5261ee"},
        {src:"../../vid/beyoud.mp4?v=0ab7d6b6", poster:"../../vid/beyoud.jpg?v=608aa10b", cover:"../../vid/beyoud-disc.jpg?v=0e07ccb5"},
        {src:"../../vid/a-curse-paper-lily.mp4?v=4cf6d6e9", poster:"../../vid/a-curse-paper-lily.jpg?v=0f92a022", cover:"../../vid/a-curse-paper-lily-disc.jpg?v=ecd26bca"}
    ];

    /* ---- 专属背景：按歌名锁定视频，进到这首歌必出，不参与上面的随机池 ----
       键是播放页 data 里的 song 字段（要与歌名完全一致） */
    var videoBgBySong={
        "内线": {src:"../../vid/feihua-rumeng.mp4?v=53754bc0", poster:"../../vid/feihua-rumeng.jpg?v=45fcfd05", cover:"../../vid/feihua-rumeng-disc.jpg?v=dc6e6b60"}
    };

    /* 专属视频自动从随机池剔除（同 src 视为同一条）：
       就算忘了手动删，专属视频也不会被别的歌随机抽到 */
    (function(){
        var used={},k,i;
        for(k in videoBgBySong){ if(videoBgBySong.hasOwnProperty(k)){ used[videoBgBySong[k].src]=1; } }
        for(i=videoBgPool.length-1;i>=0;i--){ if(used[videoBgPool[i].src]){ videoBgPool.splice(i,1); } }
    })();

    /* ---- 全站歌曲总数：自定义9 + 寻雾启示9 + 苏格拉没有底10 + 梦游计10
            + 不如吃茶去9 + 青年晚报9 + 寻宝游戏9 = 65
            随机池 14 条 → 14/65 ≈ 22%，一轮 10 次换歌里约出现 2 次 ---- */
    var videoBgTotalSongs=65;

    var ROUND_SIZE=10;   // 一轮换歌次数
    var RATIO_MIN=0.1;   // 概率下限
    var RATIO_MAX=0.5;   // 概率上限

    function shuffled(n){
        var a=[],i,j,k,t;
        for(i=0;i<n;i++){ a.push(i); }
        for(j=n-1;j>0;j--){
            k=Math.floor(Math.random()*(j+1));
            t=a[j]; a[j]=a[k]; a[k]=t;
        }
        return a;
    }

    /* 轮计划：new VideoBgPlan().next() 每次换歌调用一次，返回该步的视频配置或 null */
    function VideoBgPlan(){
        var ratio=videoBgPool.length/Math.max(1,videoBgTotalSongs);
        if(ratio<RATIO_MIN){ ratio=RATIO_MIN; }
        if(ratio>RATIO_MAX){ ratio=RATIO_MAX; }
        var perRound=Math.max(1,Math.min(ROUND_SIZE,Math.round(ratio*ROUND_SIZE)));
        var plan=[],step=0;

        function newRound(){
            plan=[];
            for(var k=0;k<ROUND_SIZE;k++){ plan.push(-1); }
            step=0;
            if(!videoBgPool.length){ return; }
            /* 位置洗牌，取前 perRound 个；视频顺序也打乱，池子不够就循环复用 */
            var slots=shuffled(ROUND_SIZE).slice(0,Math.min(perRound,ROUND_SIZE));
            var vids=[];
            while(vids.length<slots.length){ vids=vids.concat(shuffled(videoBgPool.length)); }
            for(var i=0;i<slots.length;i++){ plan[slots[i]]=vids[i]; }
        }
        newRound();

        this.ratio=ratio;
        this.perRound=perRound;
        this.next=function(){
            if(step>=ROUND_SIZE){ newRound(); }
            var v=plan[step];
            step++;
            return (v===undefined||v<0)?null:videoBgPool[v];
        };
    }

    window.VideoBgPlan=VideoBgPlan;
    window.videoBgPool=videoBgPool;
    window.videoBgBySong=videoBgBySong;
    window.videoBgTotalSongs=videoBgTotalSongs;
})();
