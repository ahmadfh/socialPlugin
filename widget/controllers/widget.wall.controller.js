'use strict';

(function (angular) {
    angular.module('socialPluginWidget')
        .controller('WidgetWallCtrl', ['$scope', 'SocialDataStore', 'Modals', 'Buildfire', '$rootScope', 'Location', 'EVENTS', 'GROUP_STATUS', 'MORE_MENU_POPUP', '$modal', 'SocialItems','$q', function ($scope, SocialDataStore, Modals, Buildfire, $rootScope, Location, EVENTS, GROUP_STATUS, MORE_MENU_POPUP, $modal, SocialItems,$q) {
            var WidgetWall = this;
            var usersData = [];
            var userIds = [];
            var postsUniqueIds = [];
            var getLikesData = [];
            var _receivePushNotification;
            WidgetWall.buildfire=Buildfire;
            WidgetWall.getFollowingStatus = function () {
                return (typeof _receivePushNotification !== 'undefined') ? (_receivePushNotification ? GROUP_STATUS.FOLLOWING : GROUP_STATUS.FOLLOW) : '';
            };
            WidgetWall.userDetails = {};
            WidgetWall.height = window.innerHeight;
            WidgetWall.noMore = false;
            WidgetWall.postText = '';
            WidgetWall.picFile = '';
            $rootScope.showThread = true;
            WidgetWall.SocialItems=SocialItems.getInstance();
            var masterItems=WidgetWall.SocialItems.items;
            console.log('SocialItems------------------Wall Controller------------------------',WidgetWall.SocialItems);
            //SocialItems.posts();
            WidgetWall.createPost = function () {
                var checkuserAuthPromise=checkUserIsAuthenticated();
                checkuserAuthPromise.then(function(response){
                    if (WidgetWall.picFile && !WidgetWall.waitAPICompletion) {                // image post
                        WidgetWall.waitAPICompletion = true;
                        var success = function (response) {
                            finalPostCreation(response.data.result);
                        };
                        var error = function (err) {
                            console.log('Error is : ', err);
                        };
                        SocialDataStore.uploadImage(WidgetWall.picFile, WidgetWall.userDetails.userToken, WidgetWall.userDetails.appId).then(success, error);
                    } else if (WidgetWall.postText && !WidgetWall.waitAPICompletion) {                        // text post
                        WidgetWall.waitAPICompletion = true;
                        finalPostCreation();
                    }
                });
            };
            var checkUserIsAuthenticated = function () {
                var deferedObject=$q.defer();
                Buildfire.auth.getCurrentUser(function (err, userData) {
                    console.info('Current Logged In user details are -----------------', userData);
                    if (userData) {
                        Buildfire.getContext(function (err, context) {
                            if(err) {
                                console.error('error inside getting buildfire context is:::::: ', err);
                                return deferedObject.reject();
                            } else {
                                deferedObject.resolve();
                                WidgetWall.userDetails.appId = context.appId;
                                WidgetWall.userDetails.parentThreadId = context.appId + context.instanceId;
                                WidgetWall.userDetails.userToken = userData.userToken;
                                WidgetWall.userDetails.userId = userData._id;
                                SocialDataStore.getUserSettings({threadId: WidgetWall.userDetails.parentThreadId, userId: WidgetWall.userDetails.userId, userToken: WidgetWall.userDetails.userToken, appId: WidgetWall.userDetails.appId}).then(function (response) {
                                    console.log('inside getUser settings :::::::::::::', response);
                                    if (response && response.data && response.data.result) {
                                        console.log('getUserSettings response is: ', response);
                                        _receivePushNotification = response.data.result.receivePushNotification;
                                        WidgetWall.userDetails.settingsId = response.data.result._id;
                                    } else if (response && response.data && response.data.error) {
                                        console.log('response error is: ', response.data.error);
                                    }

                                }, function (err) {
                                    console.log('Error while logging in user is: ', err);
                                });
                            }
                        });
                    }
                    else {
                        Buildfire.auth.login(null,function(err,user){
                            deferedObject.reject();
                            console.log('Login called---------------------------------',user,err);
                            Location.goToHome();
                        });
                    }
                });
               return  deferedObject.promise;
            };

            function finalPostCreation(imageUrl) {
                var postData = {};
                postData.text = WidgetWall.postText;
                postData.title = '';
                postData.imageUrl = imageUrl || null;
                postData.userToken = WidgetWall.userDetails.userToken;
                postData.appId = WidgetWall.SocialItems.context.appId;
                var success = function (response) {
                    WidgetWall.postText = '';
                    WidgetWall.picFile = '';
                    if (response.data.error) {
                        console.error('Error while creating post ', response.data.error);
                    } else if (response.data.result) {
                        Buildfire.messaging.sendMessageToControl({
                            name: EVENTS.POST_CREATED,
                            status: 'Success',
                            post: response.data.result
                        });
                        WidgetWall.SocialItems.items.unshift(response.data.result);
                        if (!$scope.$$phase)$scope.$digest();
                        if (userIds.indexOf(response.data.result.userId.toString()) == -1) {
                            userIds.push(response.data.result.userId.toString());
                        }
                        var successCallback = function (response) {
                            if (response.data.error) {
                                console.error('Error while fetching users ', response.data.error);
                            } else if (response.data.result) {
                                console.info('Users fetched successfully', response.data.result);
                                usersData = response.data.result;
                                WidgetWall.waitAPICompletion = false;
                            }
                        };
                        var errorCallback = function (err) {
                            console.log('Error while fetching users details ', err);
                            WidgetWall.postText = '';
                            WidgetWall.picFile = '';
                            WidgetWall.waitAPICompletion = false;
                            if (!$scope.$$phase)$scope.$digest();
                        };
                        SocialDataStore.getUsers(userIds, WidgetWall.userDetails.userToken).then(successCallback, errorCallback);
                        if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                            WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
                    }
                };
                var error = function (err) {
                    console.log('Error while creating post ', err);
                    WidgetWall.postText = '';
                    WidgetWall.picFile = '';
                    WidgetWall.waitAPICompletion = false;
                    if (!$scope.$$phase)$scope.$digest();
                };
                SocialDataStore.createPost(postData, WidgetWall.SocialItems.context.instanceId).then(success, error);
            }

            WidgetWall.getUserName = function (userId) {
                var userName = '';
                usersData.some(function (userData) {
                    if (userData.userObject._id == userId) {
                        userName = userData.userObject.displayName || '';
                        return true;
                    }
                });
                return userName;
            };
            WidgetWall.getUserImage = function (userId) {
                var userImageUrl = '';
                usersData.some(function (userData) {
                    if (userData.userObject._id == userId) {
                        userImageUrl = userData.userObject.imageUrl || '';
                        return true;
                    }
                });
                return userImageUrl;
            };
            WidgetWall.showMoreOptions=function(postId){

                var checkuserAuthPromise=checkUserIsAuthenticated();
                checkuserAuthPromise.then(function(response){
                    console.log("Post id ------------->",postId);
                    Modals.showMoreOptionsModal({})
                        .then(function(data){
                            console.log('Data in Success------------------data :????????????????????????????????????',data);

                            switch(data){

                                case MORE_MENU_POPUP.REPORT:

                                    var reportPostPromise=SocialDataStore.reportPost(postId, WidgetWall.SocialItems.appId, WidgetWall.SocialItems.userToken);
                                    reportPostPromise.then(function(response){
                                        $modal
                                            .open({
                                                templateUrl: 'templates/modals/report-generated-modal.html',
                                                controller: 'MoreOptionsModalPopupCtrl',
                                                controllerAs: 'MoreOptionsPopup',
                                                size: 'sm',
                                                resolve: {
                                                    Info: function () {
                                                        return postId;
                                                    }
                                                }
                                            });

                                    },function(){

                                    });

                                    break;
                                case MORE_MENU_POPUP.BLOCK:

                                    $modal
                                        .open({
                                            templateUrl: 'templates/modals/delete-post-modal.html',
                                            controller: 'MoreOptionsModalPopupCtrl',
                                            controllerAs: 'MoreOptionsPopup',
                                            size: 'sm',
                                            resolve: {
                                                Info: function () {
                                                    return postId;
                                                }
                                            }
                                        });
                                    break;
                                default :
                            }

                        },
                        function(err){
                            console.log('Error in Error handler--------------------------',err);
                        });
                });


            };
            WidgetWall.likeThread = function (post, type) {
                var checkuserAuthPromise=checkUserIsAuthenticated();
                checkuserAuthPromise.then(function(response){
                    var uniqueIdsArray = [];
                    uniqueIdsArray.push(post.uniqueLink);
                    var success = function (response) {
                        if (response.data && response.data.result && response.data.result.length > 0) {
                            if (response.data.result[0].isUserLikeActive) {
                                SocialDataStore.addThreadLike(post, type).then(function (res) {
                                    console.log('thread gets liked', res);
                                    Buildfire.messaging.sendMessageToControl({'name': EVENTS.POST_LIKED, '_id': post._id});
                                    post.likesCount++;
                                    post.waitAPICompletion = false;
                                    WidgetWall.updateLikesData(post._id, false);
                                    if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                                        WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
                                    if (!$scope.$$phase)$scope.$digest();
                                }, function (err) {
                                    console.error('error while liking thread', err);
                                });
                            } else {
                                SocialDataStore.removeThreadLike(post, type).then(function (res) {
                                    if (res.data && res.data.result)
                                        Buildfire.messaging.sendMessageToControl({'name': EVENTS.POST_UNLIKED, '_id': post._id});
                                    post.likesCount--;
                                    post.waitAPICompletion = false;
                                    if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                                        WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
                                    WidgetWall.updateLikesData(post._id, true);
                                    if (!$scope.$$phase)$scope.$digest();
                                }, function (err) {
                                    console.error('error while removing like of thread', err);
                                });
                            }
                        }
                    };
                    var error = function (err) {
                        post.waitAPICompletion = false;
                        console.error('error is : ', err);
                    };
                    if (!post.waitAPICompletion) {
                        post.waitAPICompletion = true;
                        SocialDataStore.getThreadLikes(uniqueIdsArray).then(success, error);
                    }
                });


            };
            WidgetWall.seeMore = function (post) {
                post.seeMore = true;
                post.limit = 10000000;
                if (!$scope.$$phase)$scope.$digest();
            };
            WidgetWall.getDuration = function (timestamp) {
                return moment(timestamp.toString()).fromNow();
            };

            WidgetWall.goInToThread = function (threadId) {

                    if (threadId)
                        Location.go('#/thread/' + threadId);
            };
            WidgetWall.isLikedByLoggedInUser = function (postId) {

                var isUserLikeActive = true;
                getLikesData.some(function (likeData) {
                    if (likeData._id == postId) {
                        isUserLikeActive = likeData.isUserLikeActive;
                        return true;
                    }
                });
                return isUserLikeActive;
            };
            WidgetWall.updateLikesData = function (postId, status) {
                getLikesData.some(function (likeData) {
                    if (likeData._id == postId) {
                        likeData.isUserLikeActive = status;
                        return true;
                    }
                })
            };
            WidgetWall.deletePost = function (postId) {
                var success = function (response) {
                    console.log('inside success of delete post', response);
                    if (response.data.result) {
                        Buildfire.messaging.sendMessageToControl({'name': EVENTS.POST_DELETED, '_id': postId});
                        console.log('post successfully deleted');
                        WidgetWall.SocialItems.items = WidgetWall.SocialItems.items.filter(function (el) {
                            return el._id != postId;
                        });
                        if (!$scope.$$phase)
                            $scope.$digest();
                    }
                };
                // Called when getting error from SocialDataStore.deletePost method
                var error = function (err) {
                    console.log('Error while deleting post ', err);
                };
                // Deleting post having id as postId
                SocialDataStore.deletePost(postId, WidgetWall.SocialItems.appId, WidgetWall.SocialItems.userToken).then(success, error);
            };

            WidgetWall.followUnfollow = function (isFollow) {
                var followNotification = false;
                if(isFollow == GROUP_STATUS.FOLLOWING) {
                    followNotification = false;
                } else if(isFollow == GROUP_STATUS.FOLLOW) {
                    followNotification = true;
                }
                SocialDataStore.saveUserSettings({threadId: WidgetWall.userDetails.parentThreadId, userId: WidgetWall.userDetails.userId, userToken: WidgetWall.userDetails.userToken, settingsId: WidgetWall.userDetails.settingsId, appId: WidgetWall.userDetails.appId, receivePushNotification: followNotification}).then(function (data) {
                    console.log('Get User Settings------------------', data);
                    if (data && data.data && data.data.result) {
                        _receivePushNotification = data.data.result.receivePushNotification;
                    }
                }, function (err) {
                    console.log('Error while getting user Details--------------', err);
                });
            };

            Buildfire.messaging.onReceivedMessage = function (event) {
                console.log('Event in wall cotroller------------------------',event);
                if (event) {
                    switch (event.name) {
                        case EVENTS.POST_DELETED :
                            WidgetWall.SocialItems.items = WidgetWall.SocialItems.items.filter(function (el) {
                                return el._id != event._id;
                            });
                            if (!$scope.$$phase)
                                $scope.$digest();
                            break;
                        case EVENTS.BAN_USER :
                            WidgetWall.SocialItems.items = WidgetWall.SocialItems.items.filter(function (el) {
                                return el.userId != event._id;
                            });
                            if (!$scope.$$phase)
                                $scope.$digest();
                            break;
                        case EVENTS.COMMENT_DELETED:
                            console.log('Comment Deleted in Wall controlled evenet called-----------',event);
                            WidgetWall.SocialItems.items.some(function (el) {
                                if (el._id == event.postId) {
                                    el.commentsCount--;
                                    return true;
                                }
                            });
                            if (!$scope.$$phase)
                                $scope.$digest();
                            break;
                        default :
                            break;
                    }
                }
            };
            function getUsersAndLikes(){
                var count=0;
                WidgetWall.SocialItems.items.forEach(function (postData) {
                    count++;
                    if (userIds.indexOf(postData.userId.toString()) == -1)
                        userIds.push(postData.userId.toString());
                    if (postsUniqueIds.indexOf(postData.uniqueLink.toString()) == -1 && count>10)
                    postsUniqueIds.push(postData.uniqueLink);
                });
                var successCallback = function (response) {
                    if (response.data.error) {
                        console.error('Error while fetching users ', response.data.error);
                    } else if (response.data.result) {
                        console.log('Users data--------------------',response);
                        usersData = response.data.result;
                    }
                };
                var errorCallback = function (err) {
                    console.error('Error while fetching users details ', err);
                };
                SocialDataStore.getUsers(userIds).then(successCallback, errorCallback);
                SocialDataStore.getThreadLikes(postsUniqueIds).then(function (response) {
                    postsUniqueIds=[];
                    if (response.data.error) {
                        console.error('Error while getting likes of thread by logged in user ', response.data.error);
                    } else if (response.data.result) {
                        getLikesData = response.data.result;
                    }
                }, function (err) {
                    console.error('Error while fetching thread likes ', err);
                });
            }
            $scope.$watch(function () {
                return WidgetWall.SocialItems.items;
            }, function(){
                if(masterItems!=WidgetWall.SocialItems.items){
                    console.log('New Items loaded----------------------------',WidgetWall.SocialItems.items);
                    masterItems=WidgetWall.SocialItems.items;
                    getUsersAndLikes();
                }
            }, true);
            $rootScope.$on(EVENTS.COMMENT_ADDED, function () {
                console.log('inside comment added event listener:::::::::::');
                if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                    WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
            });
            $rootScope.$on(EVENTS.COMMENT_LIKED, function () {
                console.log('inside comment liked event listener:::::::::::');
                if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                    WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
            });
            $rootScope.$on(EVENTS.COMMENT_UNLIKED, function () {
                console.log('inside comment unliked event listener:::::::::::');
                if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                    WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
            });
            $rootScope.$on(EVENTS.POST_LIKED, function () {
                console.log('inside post liked event listener:::::::::::');
                if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                    WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
            });
            $rootScope.$on(EVENTS.POST_UNLIKED, function () {
                console.log('inside post unliked event listener:::::::::::');
                if(WidgetWall.getFollowingStatus() != GROUP_STATUS.FOLLOWING)
                    WidgetWall.followUnfollow(GROUP_STATUS.FOLLOW);
            });
        }])
})(window.angular);