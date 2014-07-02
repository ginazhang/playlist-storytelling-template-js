define(["dojo/has",
	"esri/tasks/GeometryService",
	"storymaps/utils/Helper",
	"storymaps/playlist/core/mobile/Layout",
	"storymaps/playlist/ui/Map",
	"storymaps/playlist/ui/List",
	"esri/request",
	
	"lib/jquery-ui",
	"lib/jquery-ui.min"
	
	],
	function(has,
		GeometryService,
		Helper,
		MobileLayout,
		Map,
		List,
		esriRequest
		
		
		){

		/**
		* Core
		* @class Core
		*
		* Main class for story map application
		*
		* Dependencies: Jquery 1.10.2
		*/

		var _embed = (top != self) ? true : false,
		_mobile = has("touch"),
		_mobileLayout,
		_readyState = {
			map: false,
			list: false
		},
		_layersReady = 0,
		_map,
		_list;
		
		function requestConfig() {
		
		var appid = configOptions.appid;
		console.log('esri.arcgis.utils.arcgisUrl + "/" + appid + "/data"', esri.arcgis.utils.arcgisUrl + "/" + appid + "/data");
			var rq =  esriRequest({
				url: esri.arcgis.utils.arcgisUrl + "/" + appid + "/data",
					content:{
						f:"json"
					},
					handleAs: "json"
				});
				rq.then(function(response) {
					console.log('response', response);
					for (var key in response.values){
					console.log('response.values[key]', response.values[key]);
					if(response.values[key]!==undefined) {
						configOptions[key]=response.values[key];
					}
					}
				});
		}

		function init ()
		{
		
			requestConfig();		
			if (_embed){
				$("#banner").hide();
				$("#side-pane-buffer").hide();
			}
			if (_mobile){
				_mobileLayout = new MobileLayout(onMobileListOpen);
			}

			Helper.enableRegionLayout();

			if (configOptions.sharingUrl && location.protocol === "https:"){
				configOptions.sharingUrl = configOptions.sharingUrl.replace('http:', 'https:');
			}

			if (configOptions.geometryServiceUrl && location.protocol === "https:"){
				configOptions.geometryServiceUrl = configOptions.geometryServiceUrl.replace('http:', 'https:');
			}

			esri.arcgis.utils.arcgisUrl = configOptions.sharingUrl;
			esri.config.defaults.io.proxyUrl = configOptions.proxyUrl;
			esri.config.defaults.geometryServiceUrl = new GeometryService(configOptions.geometryServiceUrl);
			//esri.config.defaults.io.useCors = false;

			var urlObject = esri.urlToObject(document.location.href);
			urlObject.query = urlObject.query || {};

			if(urlObject.query.webmap){
				configOptions.webmap = urlObject.query.webmap;
			}
			
			_map = new Map(_mobile,configOptions.geometryServiceUrl,configOptions.bingMapsKey,configOptions.webmap,configOptions.excludedLayers,configOptions.dataFields,configOptions.playlistLegend.visible,configOptions.playlistLegend,"map","playlist-legend","legend","#side-pane",onMapLoad,onMapLegendHide,onLayersUpdate,onMarkerOver,onMarkerOut,onMarkerSelect,onMarkerRemoveSelection),
			_list = new List("#playlist","#search","#filter-content",configOptions.dataFields,onListLoad,onListGetTitleAttr,onListSelect,onListHighlight,onListRemoveHighlight,onListSearch, _map);
			
			loadMap();
			
			$(function(){
			$( "#radio" ).buttonset();
			
			//Change _searchType based on the button that is selected
			$("#projectNameRdBtn").click(function() {
				_list.setSearchType($(this).attr("value"));
			});
			$("#communityBoundaryRdBtn").click(function() {
				_list.setSearchType($(this).attr("value"));
			});
			$("#wardsRdBtn").click(function() {
				_list.setSearchType($(this).attr("value"));
			});
			});
			
		}
		
		// MAP FUNCTIONS
		
		function loadMap()
		{
			Helper.updateLoadingMessage("Loading map");
			_map.init();
			
			
		}	

		function onMapLoad(item)
		{
			if (!_readyState.map){
				updateText(item.title,item.snippet,item.description);
				_readyState.map = true;
				if (_layersReady === _map.getLayerCount()){
					_readyState.list = true;
				}
				checkReadyState();
			}
		}

		function onMapLegendHide()
		{
			$("#legend-wrapper").hide();
			$(".toggle-legend").hide();
		}

		function onLayersUpdate(graphics)
		{
		console.log('layers update', graphics);
			if (_list){
				updatePlaylist(graphics);
			}
		}

		function onMarkerOver(item)
		{
			if(_list){
				_list.highlight(item);
			}
		}

		function onMarkerOut(item)
		{
			if(_list){
				_list.removeHighlight(item);
			}
		}

		function onMarkerSelect(item)
		{
			if(_list){
				_list.select(item);
			}
		}

		function onMarkerRemoveSelection()
		{
			if(_list){
				_list.removeSelection();
			}
		}


		// LIST FUNCTIONS

		function onListLoad()
		{
			if (!_readyState.list){
				_layersReady++;
				if (_layersReady === _map.getLayerCount()){
					_readyState.list = true;
					checkReadyState();
				}
			}
		}

		function onListGetTitleAttr(titleObj)
		{
			if(_map){
				_map.setTitleAttr(titleObj);
			}
		}

		function onListSelect(item,sameItem)
		{
			if(_map && !sameItem){
				_map.select(item);
			}
			if(_mobile && sameItem){
				_mobileLayout.hideList();
			}
		}

		function onListHighlight(item)
		{
			if(_map){
				_map.highlight(item);
			}
		}

		function onListRemoveHighlight()
		{
			if(_map){
				_map.removeHighlight();
			}
		}

		function onListSearch(items)
		{
		console.log('search event');
			if(_map){
				_map.filterGraphics(items);
			}
		}

		function updatePlaylist(graphics)
		{
			Helper.updateLoadingMessage("Updating Playlist");
			_list.update(graphics);
		}

		// Mobile events
		function onMobileListOpen()
		{
			if(_map){
				_map.resizeMap();
			}
		}

		function updateText(title,subtitle,description)
		{	
			console.log('update text...');
			console.log(configOptions);
			console.log(description);
			var descriptionText = configOptions.description || description || "";
			console.log(descriptionText);
			document.title = configOptions.title || title || "";
			$(".title-text").html(configOptions.title || title || "");
			$(".subtitle-text").html(configOptions.subtitle || subtitle || "");
			$("#description").html(descriptionText);

			if (descriptionText){
				$("body").addClass("show-description");
			}
			else{
				$("#side-pane-controls .toggle-description").hide();
			}
		}

		function checkReadyState()
		{
			var ready = true;

			for (var i in _readyState){
				if (!_readyState[i]){
					ready = false;
				}
			}
			appReady(ready);
		}

		function appReady(ready)
		{
			if (ready){
				Helper.resetRegionLayout();
				Helper.removeLoadScreen();

				addSidePaneEvents();
			}
		}

		function addSidePaneEvents()
		{
			$(".playlist-control").click(function(){
				if ($(this).hasClass("toggle-side-pane")){
					$("#side-pane").toggleClass("minimized");
				}
				else if ($(this).hasClass("toggle-legend")){
					$("body").toggleClass("show-legend");
					if ($("body").hasClass("show-description")){
						$("body").removeClass("show-description");
					}
				}
				else if ($(this).hasClass("toggle-description")){
					$("body").toggleClass("show-description");
					if ($("body").hasClass("show-legend")){
						$("body").removeClass("show-legend");
					}
				}
				Helper.resetRegionLayout();
			});
		}

		return {
			init: init
		};
});