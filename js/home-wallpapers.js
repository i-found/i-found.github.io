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
        {src:"./vid/corgi-01.mp4?v=c0c5a7e6", poster:"./vid/corgi-01.jpg?v=003a2672"},
        {src:"./vid/corgi-02.mp4?v=71a8822d", poster:"./vid/corgi-02.jpg?v=c0c14c2e"},
        {src:"./vid/corgi-03.mp4?v=4dc76f78", poster:"./vid/corgi-03.jpg?v=6b7507ac"},
        {src:"./vid/corgi-04.mp4?v=a711406b", poster:"./vid/corgi-04.jpg?v=cac30627"},
        {src:"./vid/corgi-05.mp4?v=1bbe46cb", poster:"./vid/corgi-05.jpg?v=1852e4bf"},
        {src:"./vid/corgi-06.mp4?v=a689a487", poster:"./vid/corgi-06.jpg?v=c2a78ab8"},
        {src:"./vid/corgi-07.mp4?v=97eda8a8", poster:"./vid/corgi-07.jpg?v=3c8697b6"},
        {src:"./vid/corgi-08.mp4?v=f0a548ec", poster:"./vid/corgi-08.jpg?v=21490bdb"},
        {src:"./vid/corgi-09.mp4?v=e934259b", poster:"./vid/corgi-09.jpg?v=1f757d3e"},
        {src:"./vid/corgi-10.mp4?v=383792ba", poster:"./vid/corgi-10.jpg?v=b8af3d2c"},
        {src:"./vid/corgi-11.mp4?v=eeac0274", poster:"./vid/corgi-11.jpg?v=0f027ad1"},
        {src:"./vid/corgi-12.mp4?v=ce75bef7", poster:"./vid/corgi-12.jpg?v=84ec3158"},
        {src:"./vid/corgi-13.mp4?v=4986d8a0", poster:"./vid/corgi-13.jpg?v=17692ecd"},
        {src:"./vid/corgi-14.mp4?v=0701af6c", poster:"./vid/corgi-14.jpg?v=b9b7c069"},
        {src:"./vid/corgi-15.mp4?v=ed984872", poster:"./vid/corgi-15.jpg?v=74454b20"},
        {src:"./vid/corgi-16.mp4?v=c3726a94", poster:"./vid/corgi-16.jpg?v=3f2aa1c1"},
        {src:"./vid/corgi-17.mp4?v=73e7e322", poster:"./vid/corgi-17.jpg?v=558c8a28"},
        {src:"./vid/corgi-18.mp4?v=c6c1059f", poster:"./vid/corgi-18.jpg?v=e8e69182"},
        {src:"./vid/corgi-19.mp4?v=51b61e94", poster:"./vid/corgi-19.jpg?v=94367637"},
        {src:"./vid/corgi-20.mp4?v=879d3b6b", poster:"./vid/corgi-20.jpg?v=b76754ff"},
        {src:"./vid/corgi-21.mp4?v=29b39fc4", poster:"./vid/corgi-21.jpg?v=94b454a3"},
        {src:"./vid/corgi-22.mp4?v=dcac98c1", poster:"./vid/corgi-22.jpg?v=c740858e"},
        {src:"./vid/corgi-23.mp4?v=9ff088e1", poster:"./vid/corgi-23.jpg?v=cec2d00f"},
        {src:"./vid/corgi-24.mp4?v=1992dce2", poster:"./vid/corgi-24.jpg?v=09ae83b2"},
        {src:"./vid/corgi-25.mp4?v=d1cba246", poster:"./vid/corgi-25.jpg?v=aa35831d"},
        {src:"./vid/corgi-26.mp4?v=643621d3", poster:"./vid/corgi-26.jpg?v=a79ca36f"},
        {src:"./vid/corgi-27.mp4?v=90800215", poster:"./vid/corgi-27.jpg?v=bfccf4d8"},
        {src:"./vid/corgi-28.mp4?v=327ce4f4", poster:"./vid/corgi-28.jpg?v=7c47f970"},
        {src:"./vid/corgi-29.mp4?v=507a8ae2", poster:"./vid/corgi-29.jpg?v=a2752799"},
        {src:"./vid/corgi-30.mp4?v=729ea058", poster:"./vid/corgi-30.jpg?v=7b4a6405"},
        {src:"./vid/corgi-31.mp4?v=b2f64007", poster:"./vid/corgi-31.jpg?v=c4a373be"},
        {src:"./vid/corgi-32.mp4?v=d81f7a8e", poster:"./vid/corgi-32.jpg?v=86f7ef9f"},
        {src:"./vid/corgi-33.mp4?v=7343145f", poster:"./vid/corgi-33.jpg?v=46342092"},
        {src:"./vid/corgi-34.mp4?v=5b94a9cf", poster:"./vid/corgi-34.jpg?v=7e0b9b13"},
        {src:"./vid/corgi-35.mp4?v=edb01b84", poster:"./vid/corgi-35.jpg?v=a254585f"},
        {src:"./vid/corgi-36.mp4?v=09c3c407", poster:"./vid/corgi-36.jpg?v=7c7a10ad"},
        {src:"./vid/corgi-37.mp4?v=a7f0c6d7", poster:"./vid/corgi-37.jpg?v=a39a2c3b"},
        {src:"./vid/corgi-38.mp4?v=ef5620ff", poster:"./vid/corgi-38.jpg?v=71a7be4c"},
        {src:"./vid/corgi-39.mp4?v=c51d4637", poster:"./vid/corgi-39.jpg?v=37219e21"},
        {src:"./vid/corgi-40.mp4?v=431cf096", poster:"./vid/corgi-40.jpg?v=bdfe2301"},
        {src:"./vid/corgi-41.mp4?v=f5377be6", poster:"./vid/corgi-41.jpg?v=518151c7"}
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
