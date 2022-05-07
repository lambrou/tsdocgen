import {SharedArray} from "k6/data";
import http, {RequestBody} from "k6/http";
import {check, group, sleep} from "k6";
import {API, Case, Customer, QueryParameters, ResponseBody, Url, User} from "../types"
import {Options} from "k6/options";
import urlSearchParams from "../util/urlSearchParams";
import crypto from 'k6/crypto';
// @ts-ignore
import {htmlReport} from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
// @ts-ignore
import {textSummary} from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import execution from "k6/execution";


export const envUrls: Array<Url> = getSharedArray(`urls`);
export const boomtownURL = envUrls[0].boomtown
export const apiv3URL = envUrls[0].apiv3

export const envUsers: Array<User> = getSharedArray(`users`)
export const defaultUser = envUsers[0]

export const envSuperUsers: Array<User> = getSharedArray(`superusers`)
export const defaultSuperUser = envSuperUsers[0]

export const envCases: Array<Case> = getSharedArray(`cases`)
export const defaultCase = envCases[0]

export const envCustomers: Array<Customer> = getSharedArray(`customers`)
export const defaultCustomer = envCustomers[0]

export const envAPIs: Array<API> = getSharedArray(`orgs`)
export const apiKeys = envAPIs[0]

export const boomtownPassword = `B00mtown1!`
export const K6_USERS = parseInt(__ENV.K6_USERS)

export const options: Options = {
    setupTimeout: '360s',
    scenarios: {
        'use-all-users': {
            executor: 'constant-vus',
            startTime: '10s',
            gracefulStop: '15s',
            vus: K6_USERS,
            duration: '5m'
        },
    },
};

function getSharedArray(key: string): [] {
    return new SharedArray(`Shared Array Key: ${key}`, function () {
        return JSON.parse(open(`../config/${__ENV.K6_ENV.trim()}.json`))[key];
    });
}

export function handleSummary(data: any) {
    return {
        "summary.html": htmlReport(data),
        'stdout': textSummary(data, {indent: ' ', enableColors: true}),
    };
}

function getUsers(): User[] {
    const usersGetUri = `/api/v3/orgs/team/users/${defaultCustomer.sponsor.team.id}`
    let allUsers = JSON.parse(<string>apiGetRequest(usersGetUri).body).results
    const currentNumbers = getUserNumbers(allUsers)
    if (allUsers.length < K6_USERS) {
        allUsers.push(...createUsers(K6_USERS, currentNumbers))
        return allUsers
    } else {
        return allUsers.slice(0, K6_USERS)
    }
}

function getUserNumbers(users: User[]) {
    const emailRegex = /automation_[0-9]*@test\.com/
    const numberRegex = /\d+/
    let numbersList: string[] = []
    const cleanedUsers: string[][] = users.map(user => [user.email, user.id, user.status])
    cleanedUsers.forEach(user => {
        if (emailRegex.test(user[0]) && (user[2] !== 'Deleted')) {
            numbersList.push(...<RegExpMatchArray>user[0].match(numberRegex))
        }
    })
    return numbersList.sort()
}

function createUsers(targetUsers: number, skip: string[]) {
    const usersPutUri = `/api/v3/orgs/users/put`
    const baseName = 'automation'
    let userArray: User[] = []
    for (let i = 0; i < targetUsers; i++) {
        if (!skip.includes(i.toString())) {
            const [body, email] = generateUser(baseName, i)
            const res = apiPostRequest(usersPutUri, body)
            const user: User = {
                email: email,
                id: JSON.parse(<string>res.body).results[0].id,
                status: 'activated'
            }
            provisionUser(user)
            userArray.push(user)
        }
    }
    return userArray
}

function generateUser(baseName: String, iteration: number) {
    const email = `${baseName}_${iteration}@test.com`
    const body = JSON.stringify({
        users: {
            email: `${email}`,
            first_name: "automation",
            last_name: "user"
        }
    })
    return [body, email]
}

function provisionUser(user: User) {
    updatePassword([user])
    setTeam([user])
    setRole([user])
}

function updatePassword(users: User[]) {
    const usersPutUrl = `${boomtownURL}/api/users/?sAction=put`
    const csrfToken = getCsrf()
    const params: any = { headers: { "X-Boomtown-CSRF-Token": csrfToken } }
    for (const user of users) {
        const formData: any =
            [
                {
                    "password_action": "setpass",
                    "newpassword": `${boomtownPassword}`,
                    "id": `${user.id}`
                }
            ]
        appPostRequest(usersPutUrl, {users: JSON.stringify(formData)}, params)
    }
}

function setTeam(users: User[]) {
    const teamMapUri = `/api/v3/orgs/team/map_user/`
    const sponsorTeamId = defaultCustomer.sponsor.team.id
    for (const user of users) {
        const queryString = `?user_id=${user.id}`
        const path = `${teamMapUri}${sponsorTeamId}${queryString}`
        apiPostRequest(path)
    }
}

function setRole(users: User[]) {
    const usersPutUrl = `${boomtownURL}/api/users/?sAction=put`
    const adminRole = '11111111-1111-1111-1111-111111111111'
    const csrfToken = getCsrf()
    const params: any = {
        headers: {
            "X-Boomtown-CSRF-Token": `${csrfToken}`
        }
    }
    for (const user of users) {
        const formData: any = [{ role_id: `${adminRole}`, id: `${user.id}` }]
        http.post(usersPutUrl, {users: JSON.stringify(formData)}, params)
    }
}

// @ts-ignore
function deleteUsers(users: User[]) {
    const usersDelUrl = `${boomtownURL}/api/users/?sAction=delete`
    const csrfToken = getCsrf()
    const params: any = { headers: { "X-Boomtown-CSRF-Token": csrfToken } }

    for (const user of users) {
        const formData: any = [{id: `${user.id}`}]
        // Delete the user twice, as the first time it is only soft-deleted.
        http.post(usersDelUrl, {users: JSON.stringify(formData)}, params)
        http.post(usersDelUrl, {users: JSON.stringify(formData)}, params)
    }
}

function appPostRequest(path: string, body?: RequestBody, params?: object) {
    const res = http.post(path, body, params)
    return res
}

function apiPostRequest(path: string, body?: string, headers?: object) {
    const params: any = {
        headers: {
            ...getV3Headers(path),
            ...headers
        }
    }
    const res = http.post(`${apiv3URL}${path}`, body, params)
    sleep(1)
    return res
}

function apiGetRequest(path: string) {
    const params: any = {
        headers: {
            ...getV3Headers(path)
        }
    }
    const res = http.get(`${apiv3URL}${path}`, params)
    sleep(1)
    return res
}

function getV3Headers(uri: string) {
    const date: string = (new Date()).toISOString().split('.')[0] + "+00:00";
    const sigData: string = uri + ':' + date;
    // const sig:string = createHmac('sha256', `${envSecret}`)
    // 	.update(sigData).digest('base64');
    const sig: string = crypto.hmac('sha256', envAPIs[0].secret, sigData, 'base64')
    const envKey = envAPIs[0].key;
    return {
        'X-Boomtown-Token': envKey,
        'X-Boomtown-Date': date,
        'X-Boomtown-Signature': sig
    };
}

function getCsrf() {
    const statusUrl = boomtownURL + `/api/core/?sAction=userStatus`
    const statusResponse: any = http.get(statusUrl)
    const statusBody: ResponseBody = JSON.parse(statusResponse.body)
    return statusBody.csrf_token
}

function login(user: User) {
    const loginUrl = boomtownURL + '/api/core/?sAction=userLogin';
    const email = user.email
    const formData = {
        email: `${email}`,
        password: `${boomtownPassword}`
    }
    const res = http.post(loginUrl, formData)
    const body: ResponseBody = JSON.parse(<string>res.body)
    const cookies = res.cookies
    return { body, cookies }
}

function logout() {
    const logoutUrl = boomtownURL + '/api/core/?sAction=userLogout'
    http.get(logoutUrl)
}

function get200(url: string, params?: any, logBody?: boolean) {
    logBody = false
    const res = http.get(url, params);
    check(res, {
        'status is 200': (res) => res.status === 200,
    });
    if (logBody) console.log(`\nBody: ${JSON.stringify(res.body, null, 4)} `);
    sleep(1);
    return res
};

export function setup () {
    login(defaultSuperUser)
    let users = getUsers()
    logout()
    return { users: users }
}

export default function (data: { users: User[] }) {
    const vu = execution.vu;
    const responseBody = login(data.users[vu.idInInstance - 1])
    const csrfToken = getCsrf()
    const params = { headers: { "X-Boomtown-CSRF-Token": csrfToken } }

    group('test login endpoint', function (){
        check(responseBody.body, {
            'login success is true': (b) => b.success === true
        })
        check(responseBody.cookies, {
            'relay cookie exists': (c) => c['relay'][0].value.length > 0,
            'dstoken cookie exists': (c) => c['dstoken'][0].value.length > 0
        })
    })

    group('test userStatus endpoint', function () {
        const userStatusUrl = boomtownURL + `/api/core/?sAction=userStatus`
        const res = get200(userStatusUrl, params)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${userStatusUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test issues listing endpoint', function () {
        const issuesListingUrl = boomtownURL + `/api/issues/?sAction=listing&page=1&start=0&limit=25`
        const res = get200(issuesListingUrl, params)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${issuesListingUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test issues suggestions endpoint', function () {
        const issuesSuggestionUrl = boomtownURL + `/api/issues/?sAction=suggestions`
        const res = get200(issuesSuggestionUrl, params)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${issuesSuggestionUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test core meta members users endpoint', function () {
        const memberUsersQueryParams =
            [
                {
                    property: "members_id",
                    value: `${defaultCustomer.id}`
                },
                {
                    property: "members_locations_id",
                    value: `${defaultCustomer.location.id}`
                },
                {
                    property: "sponsor_id",
                    value: `${defaultCustomer.sponsor.id}`
                },
                {
                    property: "context_org_id",
                    value: `${defaultCustomer.sponsor.id}`
                }
            ]
        const searchParams: QueryParameters = [
            ['sAction', 'metaMembersUsers'],
            ['page', '1'],
            ['start', '0'],
            ['limit', '25'],
            ['query', JSON.stringify(memberUsersQueryParams)]
        ]
        const userStatusUrl = boomtownURL + `/api/core/?` + urlSearchParams(searchParams)
        const res = get200(userStatusUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${userStatusUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test members listing locations endpoint', function () {
        const locationID = defaultCustomer.location.id
        const searchParams: QueryParameters = [
            ['sAction', 'listingLocations'],
            ['page', '1'],
            ['start', '0'],
            ['limit', '25'],
            ['id', `${locationID}`]
        ]
        const listingLocationsUrl = boomtownURL + `/api/members/?` + urlSearchParams(searchParams)
        const res = get200(listingLocationsUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${listingLocationsUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test core meta KBs endpoint', function () {
        const coreMetaKBQueryParams =
            [
                {
                    property: "current_kb_id",
                    operator: "in_set"
                },
                {
                    property: "partner_ids",
                    value: [`${defaultCustomer.sponsor.id}`],
                    operator: "intersect_set"
                }
            ]
        const searchParams: QueryParameters = [
            ['sAction', 'metaKBs'],
            ['page', '1'],
            ['start', '0'],
            ['limit', '15'],
            ['query', JSON.stringify(coreMetaKBQueryParams)]
        ]
        const userStatusUrl = boomtownURL + `/api/core/?` + urlSearchParams(searchParams)
        const res = get200(userStatusUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${userStatusUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test settings views listing endpoint', function () {
        const viewsListingUrl = boomtownURL + `/api/settings/?sAction=viewsListing&page=1&start=0&limit=25`
        const res = get200(viewsListingUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${viewsListingUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test members listing users endpoint', function () {
        const contactID = defaultCustomer.contact.id
        const searchParams: QueryParameters = [
            ['sAction', 'listingUsers'],
            ['id', `${contactID}`]
        ]
        const userStatusUrl = boomtownURL + `/api/members/?` + urlSearchParams(searchParams)
        const res = get200(userStatusUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${userStatusUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test members devices listing product rollup endpoint', function () {
        const listingProductParams = [
            {
                property: "members_id",
                value: `${defaultCustomer.id}`
            },
            {
                property: "members_locations_id",
                value: `${defaultCustomer.location.id}`
            },
            {
                property: "context_org_id",
                value: `${defaultCustomer.sponsor.id}`
            }
        ]
        const searchParams: QueryParameters = [
            ['sAction', 'listingProductRollup'],
            ['page', '1'],
            ['start', '0'],
            ['limit', '15'],
            ['filter', JSON.stringify(listingProductParams)]
        ]
        const listingProductUrl = boomtownURL + `/api/members_devices/?` + urlSearchParams(searchParams)
        const res = get200(listingProductUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${listingProductUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test comm item get endpoint', function () {
        const publicCommID = defaultCase.comm.public.id
        const searchParams: QueryParameters = [
            ['sAction', 'itemGet'],
            ['is_enter', 'true'],
            ['id', `${publicCommID}`]
        ]
        const itemGetUrl = boomtownURL + `/api/comm/?` + urlSearchParams(searchParams)
        const res = get200(itemGetUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${itemGetUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test core meta partners teams users endpoint', function () {
        const sponsorTeamID = defaultCustomer.sponsor.team.id
        const filter = [
            {
                property: "team_ids",
                value: [`${sponsorTeamID}`]
            }
        ]
        const searchParams: QueryParameters = [
            ['sAction', 'metaPartnersTeamsUsers'],
            ['search_all_partners', 'false'],
            ['long_labels', 'false'],
            ['page', '1'],
            ['start', '0'],
            ['limit', '25'],
            ['filter', JSON.stringify(filter)]
        ]
        const teamUsersUrl = boomtownURL + `/api/core/?` + urlSearchParams(searchParams)
        const res = get200(teamUsersUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${teamUsersUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test healthCheck endpoint', function () {
        const healthcheckUrl = boomtownURL + `/api/core/?sAction=healthCheck`
        const res = get200(healthcheckUrl, params, true)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${healthcheckUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    group('test automation listing endpoint', function () {
        const automationListingUrl = boomtownURL + `/api/automations/?sAction=listing`
        const res = get200(automationListingUrl, params)
        if (JSON.parse(<string>res.body).success != true) {
            console.log(`${automationListingUrl} Failed: \n Headers: ${JSON.stringify(res.headers)} \n Body: ${JSON.stringify(res.body)} \n`)
        }
    })

    logout()
};

export function teardown() {}
