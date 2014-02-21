define(['jquery', 'jquery.mobile', 'app/jrmcServices', 'jquery.img.lazy', 'jquery.cookie'], function ($, $jqm, $jrmc) {
    // the global state of the player
    player = {
        lastPlayInfo: {ImageURL: null}, // the last info retrieved from the remote player
        view: {}, // the current page
        controls: {}, // the different HTML components in player footer.
        configuration: {
            refresh: 500 // how many milliseconds before refreshing data from JRMC
        }
    };

    function noop() {
    }

    function setCookie(c_name, value, exdays) {
        // build date
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + exdays);
        // build cookie value
        var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
        // set cookie
        document.cookie = c_name + '=' + c_value;
    }

// manage divs with data-role='view' to replace them with the content of the file referenced by data-src
    function loadViews() {
        var $viewHolders = $("[data-role='view']");
        $viewHolders.each(function () {
            var holder = $(this);
            var $src = holder.attr("data-src");
            $.ajax({url: $src, async: false}).done(function (data) {
                holder.replaceWith(data);
            });
        });
    }

    function prepareLibraryView(page) {
        $("img.lazy").lazyload({
            effect: "fadeIn"
        });
    }

    function prepareRemoteView(page) {
        $("#key-dsp", page).click($jrmc.showDSP);
        $("#key-up", page).click($jrmc.key('up'));
        $("#key-down", page).click($jrmc.key('down'));
        $("#key-left", page).click($jrmc.key('left'));
        $("#key-right", page).click($jrmc.key('right'));
        $("#key-ok", page).click($jrmc.key('enter'));
        $("#key-back", page).click($jrmc.key('backspace'));
    }

    function updateNowPlaying(playInfo) {
        $("#np-cover").attr("src", playInfo.ImageURL);
        $("#np-title").text(playInfo.Name);
        $("#np-artist").text(playInfo.Artist);
        $("#np-album").text(playInfo.Album);
        if (playInfo.FileKey != player.playingNowFileKey) {
            player.playingNowFileKey = playInfo.FileKey;
            $jrmc.getFileInfo(playInfo.NextFileKey, function (next) {
                $("#np-next-cover").attr("src", "MCWS/v1/File/GetImage?File=" + next.Key);
                $("#np-next").text(next.Name);
            });
        }
    }

    var onPageShowCallbacks = {
        "now-playing": function() {
            player.playingNowFileKey = undefined;
        },
        "library": prepareLibraryView,
        "playingnow-list": prepareLibraryView,
        "library-files": prepareLibraryView
    };
    var onPageCreateCallbacks = {
        "remote": prepareRemoteView
    };
    var onPlayerStatusChangeCallbacks = {
        "now-playing": updateNowPlaying
    };

    function setCurrentView(activePage) {
        var view = player.view;
        view.title = activePage.jqmData("title");
        view.type = activePage.jqmData("view");
        return view;
    }

// called when a page is loaded via Ajax, then update the surrounding page.
    function onPageShow() {
        var activePage = $.mobile.activePage;
        var view = setCurrentView(activePage);
        $("[data-role='header'] h1").text(view.title);
        $("#currentZone").text($jrmc.zoneName || '-');
        (onPageShowCallbacks[view.type] || noop)(activePage)
    }


    function onPageCreate(event) {
        var activePage = $(event.target);
        var view = setCurrentView(activePage);
        (onPageCreateCallbacks[view.type] || noop)(activePage)
    }

    function updatePlayerControlStatus(playInfo) {
        this.title.text(playInfo.PositionDisplay + " " + playInfo.Name);
        var imageURL = playInfo.ImageURL;
        if (player.lastPlayInfo.ImageURL != imageURL) {
            this.cover.attr("src", imageURL);
        }
        var mute = player.controls.mute;
        var slider = this.volume_slider.parent().find(".ui-slider-bg");
        if (playInfo.VolumeDisplay == $jrmc.infos.muted) {
            mute.addClass('muted');
            slider.addClass("muted");
        } else {
            mute.removeClass('muted');
            slider.removeClass("muted");
        }
        if (playInfo.State == 2) {
            this.playpause.removeClass('muted');
        } else {
            this.playpause.addClass('muted');
        }
        this.volume_slider.val(playInfo.Volume * 100).slider("refresh");
        this.currentVolume.text(playInfo.VolumeDisplay);
    }

    function refreshPlayerStatus() {
        $jrmc.getPlaybackInfo(function (playInfo) {
            updatePlayerControlStatus.call(player.controls, playInfo);
            (onPlayerStatusChangeCallbacks[player.view.type] || noop).call(player.controls, playInfo);
            player.lastPlayInfo = playInfo;
            setTimeout(refreshPlayerStatus, player.configuration.refresh);
        });
    }

    function createPlayerControls(player) {
        var footer = $(".player-control");
        player.controls = {
            title: $(".now-playing", footer),
            next: $(".control-next", footer),
            previous: $(".control-prev", footer),
            stop: $(".control-stop", footer),
            playpause: $(".control-play", footer),
            mute: $(".control-vol-mute", footer),
            volinc: $(".control-vol-inc", footer),
            voldec: $(".control-vol-dec", footer),
            cover: $(".cover", footer),
            currentVolume: $(".control-current-volume", footer),
            volume_slider: $('#slider', footer)
        };
        return player.controls;
    }

    function initializePlayControlCallbacks(control) {
        control.next.click($jrmc.next);
        control.playpause.click($jrmc.playpause);
        control.previous.click($jrmc.previous);
        control.stop.click($jrmc.stop);
        control.mute.click($jrmc.mute);
    }

    $(function () {
        $jrmc.init();
        loadViews();
        $("[data-role='header'], [data-role='footer']").toolbar();
        $("[data-role='popup']").popup();
        initializePlayControlCallbacks(createPlayerControls(player));
        onPageShow();
        refreshPlayerStatus();
    });

// Update the contents of the pages when loading a new page with Ajax
    $(document).on("pageshow", "[data-role='page']", onPageShow);
    $(document).on("pagecreate", "[data-role='page']", onPageCreate);
    return {
        setZone: function (zoneId, zoneName) {
            if (zoneId != 'play') {
                $jrmc.zone = zoneId;
                $jrmc.zoneName = zoneName;
                zoneId = "remote(" + zoneId + ")";
            }
            setCookie('mode', zoneId, 365);
        }
    }
});