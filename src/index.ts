import { MessagingService, 
    RequestPayload, 
    RequestResponse, 
    RequestEnum, 
    formatRequest, 
    Source,
    RequestWhereType,
    RequestWhere,
SocialMediaRequestPayload, 
SocialMediaRequestResponse,
RelationshipPostRequestContent,
RelationshipPostResponseContent,
CreatePostRequestContent,
CreatePostResponseContent} from 'influencers-service-bus';
import * as globalModels from 'influencers-models';
import 'dotenv/config';

var init = false;
var run = true;
var processItem = true;
const name = 'backgroundService_poster';


(async () => {
    while(run) {
        if (!init) {
            await MessagingService.init();
            init = true;
        }
        try
        {
            //Lectura del ad pendiente de crear sus post         
            let personCredential = await getPersonCredential();
            if (personCredential === null) {
                console.log('nada que leer por el momento');
                processItem = false;
            } else { processItem = true;}

            //#region Procesamiento del item
            if (processItem) {
                //#region Solicito al conector que traiga los amigos de este sujeto
                let friends = await getFriends(personCredential);
                console.log(friends);
                //#endregion
            }
        }
        catch (err)
        {
            console.log('se rompo', err);
            run = false;
        }
    }

})();

async function getFriends(personCredential) {
    var row = new RelationshipPostRequestContent(personCredential);

    var requestRelationship = new SocialMediaRequestPayload(personCredential.platform, row);

    console.log(requestRelationship);
    var responseRelationship : SocialMediaRequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.SOCIALMEDIA, RequestEnum.SocialMedia_Request.READ_RELATIONSHIP), requestRelationship));
    console.log(responseRelationship);

    return  (responseRelationship.payload as RelationshipPostResponseContent).platformObjectIdentities;
}

async function getPersonCredential() {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.person_credential, null, 
        [
            new RequestWhere(RequestWhereType.LESSOREQUALTHAN, globalModels.person_credentialFields.friendsFeedDt,  await (Date.now() - (60 * 1000))),
            new RequestWhere(RequestWhereType.EQUAL, globalModels.person_credentialFields.friendsFeedStatus, globalModels.person_credential_fiendsFeedStatusEnum.Idle),
            new RequestWhere(RequestWhereType.NOTEQUAL , globalModels.person_credentialFields.personId, null)
        ],
        {
            [globalModels.person_credentialFields.friendsFeedStatus]: globalModels.person_credential_fiendsFeedStatusEnum.Fetching
        }, 
        null, null, null, null, [globalModels.person_credentialFields.creationDt], true);
        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.FIND_ONE_AND_UPDATE), request));
        console.log(response);
        return response.entity;
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function createPostInSocialMedia(advertisement, platform) {
    var row = new CreatePostRequestContent(advertisement);

    var requestSocialMediaPost = new SocialMediaRequestPayload(platform, row);

    console.log(requestSocialMediaPost);
    var responseSocialMedia : SocialMediaRequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.SOCIALMEDIA, RequestEnum.SocialMedia_Request.CREATE_POST), requestSocialMediaPost));
    console.log(responseSocialMedia);

    return  {status: "Posted", postPlatformId: (responseSocialMedia.payload as CreatePostResponseContent).postPlatformId};

}

async function createPostInBD(ad, platform, postPlatformId) {
    var request = new RequestPayload();
    await request.init(globalModels.Model.post, null, null, {
        [globalModels.postFields.advertisementId]: ad._id,
        [globalModels.postFields.campaignId]: ad[globalModels.advertisementFields.campaignId],
        [globalModels.postFields.companyId]: ad[globalModels.advertisementFields.companyId],
        [globalModels.postFields.platform]: platform,
        [globalModels.postFields.postPlatformId]: postPlatformId,

    }, null, null, null, null);

    var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.CREATE), request));

    console.log(`Nuevo Post ${response.entity._id}`);
}

async function changeStatusPlatform(adId, platform, platformStatus) {
    try{
        var request = new RequestPayload();
        var platformField = '';
        switch (platform.toString()) {
            case "Facebook":
            platformField = "facebookStatus";
            break;
            case "Instagram":
            platformField = "instagramStatus";
            break;
            case "Twitter":
            platformField = "twitterStatus";
            break;
            default:
            platformField = "aa";
                break;
        }
        let args = {_id: adId, [platformField]: platformStatus};
        await request.init(globalModels.Model.advertisement, null, null, args, args._id, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.UPDATE), request));

        return {entity: response.entity, ok: true, detail: null};
    }
    catch (err){
        console.log(err);
        return {entity: null, ok: false, detail: err};
    }
}

async function verifyExist(adId, platform) {
    var request = new RequestPayload();
    await request.init(globalModels.Model.post, 
        null, 
        {
            [globalModels.postFields.advertisementId]: adId,
            [globalModels.postFields.platform]: platform,
        }, null, null, null, null, null);

    var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.READ_COUNT), request));
    if (response.count && response.count > 0) return true;
    else return false;
}



