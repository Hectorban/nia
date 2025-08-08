Requesting current expression state list
You can get the current state (active or inactive) of one specific expression or all expressions. If you include "expressionFile", only the state of that expression will be returned. If you don't include it or leave it as an empty string, the state of all expressions in the current model will be returned.

If you include a filename but it's invalid (doesn't end in .exp3.json) or not found in the current model, an error is returned (see "ErrorID.cs").

Setting "details" to true will return a few more details in the response (specifically, the "usedInHotkeys" and "parameters" arrays will be empty if "details" is set to false).

REQUEST

{
	"apiName": "VTubeStudioPublicAPI",
	"apiVersion": "1.0",
	"requestID": "SomeID",
	"messageType": "ExpressionStateRequest",
	"data": {
		"details": true,
		"expressionFile": "myExpression_optional_1.exp3.json",
	}
}
The expressions array will be empty if no model is loaded. Otherwise, this will contain information about the available expressions for the currently loaded model.

The "file" field is the filename of the expression as it is stored in the model folder. "name" is the same just without the .exp3.json extension. "active" tells you whether or not the expression is currently active.

If the expression was activated using a hotkey, "deactivateWhenKeyIsLetGo" and "autoDeactivateAfterSeconds" will tell you whether or not those options were activated for the expression hotkey. If "autoDeactivateAfterSeconds" is true, the remaining time until the expression is automatically deactivated will be returned in "secondsRemaining" (otherwise it will be 0).

If "details" was set to true in the request the "usedInHotkeys" array will contain a list of all hotkeys that this expression is used in. Also, the "parameters" array will contain the contents of the expression, meaning the Live2D parameter IDs and target values of all parameters used in the expression.

RESPONSE

{
	"apiName": "VTubeStudioPublicAPI",
	"apiVersion": "1.0",
	"timestamp": 1625405710728,
	"requestID": "SomeID",
	"messageType": "ExpressionStateResponse",
	"data": {
		"modelLoaded": true,
		"modelName": "My Currently Loaded Model",
		"modelID": "UniqueIDOfModel",
		"expressions": [
			{
				"name": "myExpression_optional_1",
				"file": "myExpression_optional_1 .exp3.json",
				"active": false,
				"deactivateWhenKeyIsLetGo": false,
				"autoDeactivateAfterSeconds": false,
				"secondsRemaining": 0,
				"usedInHotkeys": [
					{
						"name": "Some Hotkey",
						"id": "SomeUniqueIdToIdentifyHotkeyWith1"
					},
					{
						"name": "Some other Hotkey",
						"id": "SomeUniqueIdToIdentifyHotkeyWith2"
					}
				],
				"parameters": [
					{
						"name": "SomeLive2DParamID",
						"value": 0
					}
				]
			}
		]
	}
}
Requesting activation or deactivation of expressions
It's recommended to activate expressions via hotkeys since otherwise users could end up with activated expressions they can't deactivate because they don't have hotkeys set up for them. However, you can also activate and deactivate hotkeys directly if that's required for your plugin. You do this by passing in an expression file name and whether the expression should be activated or deactivated.

REQUEST

{
	"apiName": "VTubeStudioPublicAPI",
	"apiVersion": "1.0",
	"requestID": "SomeID",
	"messageType": "ExpressionActivationRequest",
	"data": {
		"expressionFile": "myExpression_1.exp3.json",
		"fadeTime": 0.5,
		"active": true
	}
}
You will get this empty response if the request was successful. If the filename is invalid (doesn't end in .exp3.json) or not found in the current model or no model is loaded, an error is returned (see "ErrorID.cs"). The fadeTime parameter is clamped between 0 and 2 seconds. Its default is 0.25. Note that the fade time can only be set while fading in due to restrictions from the VTS animation system. When fading out an expression, the same time from the fade in will always be used.

RESPONSE

{
	"apiName": "VTubeStudioPublicAPI",
	"apiVersion": "1.0",
	"timestamp": 1625405710728,
	"requestID": "SomeID",
	"messageType": "ExpressionActivationResponse",
	"data": { }
}