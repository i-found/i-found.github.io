/* =========================================================================
   首页「介绍页卡片」的随机动态壁纸池（Doggie Corgi 03 系列，41 条）
   -------------------------------------------------------------------------
   卡片小图只显示这里的 poster（首帧图，静态）；
   视频 src 只在你点全屏时才真正加载播放 —— 所以切卡片永远不可能串帧，
   也不会为了看一眼卡片去下 3MB 视频。

   发牌用「洗牌袋」：一轮内 41 条各发一次，不会连续重复，
   也不会出现某几条永远抽不到。发完一轮重新洗。

   追加新素材：转好 vid/corgi-42.mp4 + corgi-42.jpg，在末尾加一条即可，
   然后在站点根目录跑一次 python _stamp_version.py（自动补 ?v= 内容哈希）。
   ========================================================================= */
(function(){
    var pool=[
        {src:"https://media.meimei.qzz.io/vid/corgi-01.mp4?v=ecdf46fd", poster:"./vid/corgi-01.jpg?v=7afc4449"},
        {src:"https://media.meimei.qzz.io/vid/corgi-02.mp4?v=a75ac823", poster:"./vid/corgi-02.jpg?v=d529f52a"},
        {src:"https://media.meimei.qzz.io/vid/corgi-03.mp4?v=181f279d", poster:"./vid/corgi-03.jpg?v=87aba992"},
        {src:"https://media.meimei.qzz.io/vid/corgi-04.mp4?v=7ddb61ff", poster:"./vid/corgi-04.jpg?v=b79c6e0f"},
        {src:"https://media.meimei.qzz.io/vid/corgi-05.mp4?v=cf09538b", poster:"./vid/corgi-05.jpg?v=3d3a75a7"},
        {src:"https://media.meimei.qzz.io/vid/corgi-06.mp4?v=32678f42", poster:"./vid/corgi-06.jpg?v=5ed74185"},
        {src:"https://media.meimei.qzz.io/vid/corgi-07.mp4?v=08d143f4", poster:"./vid/corgi-07.jpg?v=d8345ad4"},
        {src:"https://media.meimei.qzz.io/vid/corgi-08.mp4?v=61af3252", poster:"./vid/corgi-08.jpg?v=8e3c1cf6"},
        {src:"https://media.meimei.qzz.io/vid/corgi-09.mp4?v=ae033af9", poster:"./vid/corgi-09.jpg?v=a46bb3eb"},
        {src:"https://media.meimei.qzz.io/vid/corgi-10.mp4?v=eda7b288", poster:"./vid/corgi-10.jpg?v=c80c990a"},
        {src:"https://media.meimei.qzz.io/vid/corgi-11.mp4?v=46b60918", poster:"./vid/corgi-11.jpg?v=da2b951a"},
        {src:"https://media.meimei.qzz.io/vid/corgi-12.mp4?v=68ed8597", poster:"./vid/corgi-12.jpg?v=0c3140fd"},
        {src:"https://media.meimei.qzz.io/vid/corgi-13.mp4?v=6737d9b7", poster:"./vid/corgi-13.jpg?v=2e090ad7"},
        {src:"https://media.meimei.qzz.io/vid/corgi-14.mp4?v=93622d6d", poster:"./vid/corgi-14.jpg?v=f038d1f9"},
        {src:"https://media.meimei.qzz.io/vid/corgi-15.mp4?v=8ce1fb19", poster:"./vid/corgi-15.jpg?v=2c87cce8"},
        {src:"https://media.meimei.qzz.io/vid/corgi-16.mp4?v=1e171066", poster:"./vid/corgi-16.jpg?v=e6ab81c9"},
        {src:"https://media.meimei.qzz.io/vid/corgi-17.mp4?v=2178dfc2", poster:"./vid/corgi-17.jpg?v=4420bcc1"},
        {src:"https://media.meimei.qzz.io/vid/corgi-18.mp4?v=eb347529", poster:"./vid/corgi-18.jpg?v=c3cc6f48"},
        {src:"https://media.meimei.qzz.io/vid/corgi-19.mp4?v=95976420", poster:"./vid/corgi-19.jpg?v=1dcc9de5"},
        {src:"https://media.meimei.qzz.io/vid/corgi-20.mp4?v=72f6ddf9", poster:"./vid/corgi-20.jpg?v=cf3ca049"},
        {src:"https://media.meimei.qzz.io/vid/corgi-21.mp4?v=7abcbcdd", poster:"./vid/corgi-21.jpg?v=32afc6be"},
        {src:"https://media.meimei.qzz.io/vid/corgi-22.mp4?v=d0f04bf4", poster:"./vid/corgi-22.jpg?v=b9a3b5eb"},
        {src:"https://media.meimei.qzz.io/vid/corgi-23.mp4?v=7d5ccafa", poster:"./vid/corgi-23.jpg?v=604f1e87"},
        {src:"https://media.meimei.qzz.io/vid/corgi-24.mp4?v=3261b3d7", poster:"./vid/corgi-24.jpg?v=2cfc3ab2"},
        {src:"https://media.meimei.qzz.io/vid/corgi-25.mp4?v=adeb7d85", poster:"./vid/corgi-25.jpg?v=30281221"},
        {src:"https://media.meimei.qzz.io/vid/corgi-26.mp4?v=ce5846b9", poster:"./vid/corgi-26.jpg?v=e03cdf2c"},
        {src:"https://media.meimei.qzz.io/vid/corgi-27.mp4?v=a6b3574e", poster:"./vid/corgi-27.jpg?v=fa9a753a"},
        {src:"https://media.meimei.qzz.io/vid/corgi-28.mp4?v=f9f51465", poster:"./vid/corgi-28.jpg?v=64cbe8cf"},
        {src:"https://media.meimei.qzz.io/vid/corgi-29.mp4?v=da263f84", poster:"./vid/corgi-29.jpg?v=3f1dff58"},
        {src:"https://media.meimei.qzz.io/vid/corgi-30.mp4?v=b79ee43d", poster:"./vid/corgi-30.jpg?v=10e2ddad"},
        {src:"https://media.meimei.qzz.io/vid/corgi-31.mp4?v=5ddae520", poster:"./vid/corgi-31.jpg?v=0f083a95"},
        {src:"https://media.meimei.qzz.io/vid/corgi-32.mp4?v=a5652f7c", poster:"./vid/corgi-32.jpg?v=841ca6b6"},
        {src:"https://media.meimei.qzz.io/vid/corgi-33.mp4?v=2452f6d4", poster:"./vid/corgi-33.jpg?v=dd7dcc18"},
        {src:"https://media.meimei.qzz.io/vid/corgi-34.mp4?v=c12625a2", poster:"./vid/corgi-34.jpg?v=9ba66c5f"},
        {src:"https://media.meimei.qzz.io/vid/corgi-35.mp4?v=90f4dcbc", poster:"./vid/corgi-35.jpg?v=6bb7f3d6"},
        {src:"https://media.meimei.qzz.io/vid/corgi-36.mp4?v=dfa02807", poster:"./vid/corgi-36.jpg?v=fee3fbef"},
        {src:"https://media.meimei.qzz.io/vid/corgi-37.mp4?v=c236d20d", poster:"./vid/corgi-37.jpg?v=a39a2c3b"},
        {src:"https://media.meimei.qzz.io/vid/corgi-38.mp4?v=99fbaaec", poster:"./vid/corgi-38.jpg?v=62cd44ed"},
        {src:"https://media.meimei.qzz.io/vid/corgi-39.mp4?v=6c0bd6e5", poster:"./vid/corgi-39.jpg?v=13cbc918"},
        {src:"https://media.meimei.qzz.io/vid/corgi-40.mp4?v=5324e270", poster:"./vid/corgi-40.jpg?v=813c0133"},
        {src:"https://media.meimei.qzz.io/vid/corgi-41.mp4?v=ba25c729", poster:"./vid/corgi-41.jpg?v=4595a32e"}
    ];

    var bag=[];

    function shuffled(arr){
        var a=arr.slice(), i, j, t;
        for(i=a.length-1;i>0;i--){
            j=Math.floor(Math.random()*(i+1));
            t=a[i]; a[i]=a[j]; a[j]=t;
        }
        return a;
    }

    /* 取下一张壁纸：池子空了就重新洗一轮 */
    function next(){
        if(!pool.length){ return null; }
        if(!bag.length){ bag=shuffled(pool); }
        return bag.pop();
    }

    window.homeWallpaperPool=pool;
    window.nextHomeWallpaper=next;
})();
