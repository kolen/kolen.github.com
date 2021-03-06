/* Create a cache object */
var cache = new LastFMCache();

/* Create a LastFM object */
var lastfm = new LastFM({
    apiKey    : 'b64aac69ec50fe99a2550b53c70a175b',
    apiSecret : '75251d24696c1dd6b7db7a5d6af760af',
    cache     : cache
});

var all_library_artists = {
    user: null,
    artists: null
}

var SimilarViewModel = function() {
    this.isRunning = ko.observable(false)
    this.username = ko.observable(localStorage.user ? localStorage.user : "")
    this.artist = ko.observable("")
    this.minListens = ko.observable(3)

    this.consoleText = ko.observable("Ready\n")
    this.artistsInLibrary = ko.observable(0)
    this.resultArtists = ko.observableArray()
    this.similarArtistsReturned = ko.observable(0)
    this.similarArtistsAfterFilter = ko.observable(0)
    this.artistsFiltered = ko.computed(function(){
        return this.similarArtistsReturned()-this.similarArtistsAfterFilter()
    }, this)

    this.progress = {
        requestsToDo: ko.observable(1),
        requestsDone: ko.observable(0),
    }
    this.progress.percent = ko.computed(function() {
        var frac_requests = this.progress.requestsDone() / this.progress.requestsToDo()
        var perc = 0.1 + 0.9 * frac_requests
        return Math.round(perc * 100) + "%"
    }, this)
    this.progress.visible = ko.computed(function() {
        return this.isRunning()
    }, this).extend({ throttle: 300 })

    this.run = function() {
        this.progress.requestsToDo(1)
        this.progress.requestsDone(0)
        this.isRunning(true)
        this.resultArtists.removeAll()
        if (!this.isCacheValid()) {
            this.getAllLibraryArtists(this.username(), function(artists) {
                var artists_ = {__length: 0}
                artists.forEach(function(a){artists_[a.name]=a.playcount; artists_.__length++})
                localStorage.user = this.username()
                localStorage.artists = JSON.stringify(artists_)
                localStorage.version = 2
                this.generateResults(artists_, this.artist())
            })
        } else {
            var artists = JSON.parse(localStorage.artists)
            this.console("Got library from cache")
            this.artistsInLibrary(artists.__length)
            this.generateResults(artists, this.artist())
        }
    }

    this.isCacheValid = function() {
        return ((localStorage.user == this.username()) && localStorage.artists &&
            localStorage.version == 2)
    }

    this.generateResults = function(library, artist) {
        s = this
        lastfm.artist.getSimilar({artist:artist, autocorrect:1}, {
            success: function(data) {
                var filtered_artists = data.similarartists.artist.filter(function(a){
                    return library[a.name] === undefined || library[a.name] < s.minListens()
                })
                filtered_artists.forEach(function(a){
                    a.countInLibrary = library[a.name] ? library[a.name] : 0
                    s.resultArtists.push(a)
                })

                s.similarArtistsReturned(data.similarartists.artist.length)
                s.similarArtistsAfterFilter(filtered_artists.length)

                s.isRunning(false)
                s.progress.requestsDone(s.progress.requestsDone()+1)
            },
            error: function(error, message) {
                s.console("Error: "+message)
                s.isRunning(false)
            }
        })
    }

    this.console = function(text) {
        this.consoleText(this.consoleText() + text + "\n")
    }

    this.consoleClear = function(text) {
        this.consoleText("")
    }

    this.getAllLibraryArtists = function(username, callback) {
        var artists = []
        var total_pages = null
        var current_page = 1
        var page_size = 100
        var delay = 1000

        s = this
        var getNext = function() {
            s.console("Getting libary for "+username+", page "+current_page+" / "+(total_pages ? total_pages : "unknown"))
            lastfm.library.getArtists({user: username, page: current_page, limit: page_size}, {
                success: function(data) {
                    if (data && data.artists && data.artists.artist) {
                        var new_artists = data.artists.artist
                    
                        s.artistsInLibrary(data.artists['@attr'].total)
                        if (total_pages === null) {
                            total_pages = data.artists['@attr'].totalPages
                            s.progress.requestsToDo(total_pages) // -1 already done +1 request for artists
                        }

                        artists = artists.concat(new_artists)
                    }
                    s.progress.requestsDone(current_page)

                    if (current_page < total_pages) {
                        current_page++
                        setTimeout(function(){getNext.call(s)}, delay)
                    } else {
                        callback.call(s, artists)
                    }
                },
                error: function(error, message) {
                    s.console("Error: "+message)
                    s.isRunning(false)
                }
            })
        }
        getNext()
    }
}

ko.applyBindings(new SimilarViewModel())

